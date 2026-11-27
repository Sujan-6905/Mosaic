import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";

const byRecent = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);

// A new chat stays local until its first message, so opening one and walking away leaves nothing in the list.
export default function useAssistantConversations({ shareId, token, isOpen, showToast }) {
    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const loadedRef = useRef(false);
    // The list can land after the person has already started, opened or cleared a thread, and must
    // neither drop that thread nor switch them away from it.
    const threadChosenRef = useRef(false);
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    const show = useCallback(
        async (conversationId) => {
            setActiveId(conversationId);
            setMessages([]);
            setLoading(true);
            try {
                const { data } = await axiosInstance.get(`/api/ai/${shareId}/conversations/${conversationId}`, authHeaders);
                setMessages(data.conversation.messages);
            } catch (error) {
                showToast?.error("Error", "Couldn't open that chat.");
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [shareId, token],
    );

    const open = useCallback(
        (conversationId) => {
            threadChosenRef.current = true;
            return show(conversationId);
        },
        [show],
    );

    useEffect(() => {
        if (!isOpen || !shareId || !token || loadedRef.current) return;
        loadedRef.current = true;
        axiosInstance
            .get(`/api/ai/${shareId}/conversations`, authHeaders)
            .then(({ data }) => {
                const list = [...data.conversations].sort(byRecent);
                setConversations((prev) => [...prev.filter((conversation) => !list.some((listed) => listed.id === conversation.id)), ...list].sort(byRecent));
                if (list.length > 0 && !threadChosenRef.current) show(list[0].id);
            })
            .catch(() => showToast?.error("Error", "Failed to load your chats with the assistant."));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, shareId, token]);

    const startNew = useCallback(() => {
        threadChosenRef.current = true;
        setActiveId(null);
        setMessages([]);
    }, []);

    // Called just before a message is sent: returns the active thread's id,
    // creating the thread on the server first when this is a new chat.
    const ensureConversation = useCallback(
        async (firstPrompt) => {
            if (activeId) return activeId;
            threadChosenRef.current = true;
            const { data } = await axiosInstance.post(`/api/ai/${shareId}/conversations`, { title: firstPrompt.slice(0, 80) }, authHeaders);
            setConversations((prev) => [data.conversation, ...prev]);
            setActiveId(data.conversation.id);
            return data.conversation.id;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeId, shareId, token],
    );

    const touch = useCallback((conversationId) => {
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c)).sort(byRecent));
    }, []);

    const rename = useCallback(
        async (conversationId, title) => {
            try {
                const { data } = await axiosInstance.patch(`/api/ai/${shareId}/conversations/${conversationId}`, { title }, authHeaders);
                setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, title: data.conversation.title } : c)));
            } catch (error) {
                showToast?.error("Error", "Couldn't rename that chat.");
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [shareId, token],
    );

    const remove = useCallback(
        async (conversationId) => {
            try {
                await axiosInstance.delete(`/api/ai/${shareId}/conversations/${conversationId}`, authHeaders);
                setConversations((prev) => prev.filter((c) => c.id !== conversationId));
                if (conversationId === activeId) startNew();
            } catch (error) {
                showToast?.error("Error", "Couldn't delete that chat.");
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [shareId, token, activeId, startNew],
    );

    return { conversations, activeId, messages, setMessages, loading, open, startNew, ensureConversation, touch, rename, remove };
}
