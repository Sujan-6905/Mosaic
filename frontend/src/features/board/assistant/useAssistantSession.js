import axiosInstance from "@/lib/axiosInstance";
import { diffForAcceptedOps, initiallyAcceptedIndexes } from "./editReview";
import { socket } from "@/lib/socket.js";
import useAssistantConversations from "./useAssistantConversations";
import useAssistantScroll from "./useAssistantScroll";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePresence from "@/hooks/usePresence";
import {
    AUTO_APPLY_STORAGE_KEY,
    PANEL_EXIT_MS,
    TURN_TIMEOUT_MS,
    buildPreviewElements,
    buildSketchPreviewElements,
    describeRequestFailure,
    isAbort,
    readAutoApply,
    sketchPartsOf,
} from "./assistantHelpers";

// Everything the assistant panel does: its conversations, the turn in flight, the
// proposal under review, and its connection to the board. The panel itself draws.
export default function useAssistantSession({
    shareId,
    token,
    userId,
    aiEnabled,
    canEdit,
    isOpen,
    showToast,
    selectedElementIds,
    getViewportBounds,
    onDisambiguationChange,
    onPreviewChange,
    previewIsStale,
}) {
    const chats = useAssistantConversations({ shareId, token, isOpen, showToast });
    const { mounted, closing } = usePresence(isOpen, PANEL_EXIT_MS);
    const { messages, setMessages, activeId } = chats;
    const [autoApply, setAutoApply] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [ignoreSelection, setIgnoreSelection] = useState(false);
    // Session-only state per message index: fresh replies to stream, open
    // previews/choices, agent traces, inserted diagrams.
    const [live, setLive] = useState({});
    const [pending, setPending] = useState(null); // { mode, rows, startedAt, turnId }
    const [preview, setPreview] = useState(null); // { token, diff, opsPreview, accepted, messageIndex, focusedIds, comparing, ... }
    const [disambiguation, setDisambiguation] = useState(null); // { instruction, candidates, messageIndex }
    const settingsRef = useRef(null);
    const abortRef = useRef(null);
    const traceRowsRef = useRef([]);
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    const threadIsEmpty = messages.length === 0;
    const { scrollRef, contentRef, composerRef, composerHeight, pinned, pinToBottom } = useAssistantScroll({
        isOpen,
        activeId,
        loading: chats.loading,
        threadIsEmpty,
    });
    const selection = ignoreSelection ? [] : selectedElementIds || [];

    useEffect(() => setAutoApply(readAutoApply()), []);
    useEffect(() => setIgnoreSelection(false), [selectedElementIds]);

    useEffect(() => {
        if (!settingsOpen) return undefined;
        const closeOnOutsidePointer = (event) => {
            if (!settingsRef.current?.contains(event.target)) setSettingsOpen(false);
        };
        // Capture phase, so a press on something that stops propagation still closes it.
        document.addEventListener("pointerdown", closeOnOutsidePointer, true);
        return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
    }, [settingsOpen]);

    const setAutoApplyPreference = (next) => {
        setAutoApply(next);
        try {
            window.localStorage.setItem(AUTO_APPLY_STORAGE_KEY, String(next));
        } catch {
            // Preference simply won't persist in a storage-blocked browser.
        }
    };

    const setPreviewFocus = useCallback((focusedIds) => setPreview((prev) => (prev && prev.focusedIds !== focusedIds ? { ...prev, focusedIds } : prev)), []);
    const setPreviewComparing = useCallback((comparing) => setPreview((prev) => (prev && prev.comparing !== comparing ? { ...prev, comparing } : prev)), []);

    const patchLive = useCallback((index, patch) => setLive((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } })), []);

    // Closing the panel unmounts the thread, so a reply still mid-stream has to
    // be marked finished here or it would stream again from the top on reopen.
    useEffect(() => {
        if (isOpen) return;
        setLive((prev) => Object.fromEntries(Object.entries(prev).map(([index, state]) => [index, { ...state, streamed: true }])));
    }, [isOpen]);

    // Threads switch wholesale: anything session-only belongs to the old one.
    useEffect(() => {
        setLive({});
        setPreview(null);
        setDisambiguation(null);
    }, [activeId]);

    const appendAssistant = useCallback(
        (message, liveState = {}) => {
            setMessages((prev) => {
                const index = prev.length;
                setLive((current) => ({ ...current, [index]: { fresh: true, ...liveState } }));
                return [...prev, { role: "assistant", createdAt: Date.now(), ...message }];
            });
        },
        [setMessages],
    );

    // Streams this user's own agent turn stages (understanding, planning, checking) so a slow grounded turn reads
    // as working; PresenceBar shows a collaborator's turn to everyone else.
    useEffect(() => {
        const handleActivity = (payload) => {
            if (payload.shareId !== shareId || payload.userId !== userId) return;
            if (traceRowsRef.current.at(-1)?.primary !== payload.label) {
                traceRowsRef.current = [...traceRowsRef.current, { primary: payload.label }];
            }
            setPending((prev) => (prev ? { ...prev, rows: traceRowsRef.current, turnId: payload.turnId } : prev));
        };
        socket.on("server:agentActivity", handleActivity);
        return () => socket.off("server:agentActivity", handleActivity);
    }, [shareId, userId]);

    const previewDiff = useMemo(() => (preview ? diffForAcceptedOps(preview.diff, preview.opsPreview, preview.accepted) : null), [preview]);
    const previewFocusedIds = preview?.focusedIds ?? null;
    const previewComparing = preview?.comparing ?? false;
    useEffect(() => {
        onPreviewChange?.(previewDiff ? { diff: previewDiff, fullDiff: preview.diff, focusedIds: previewFocusedIds, comparing: previewComparing } : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewDiff, previewFocusedIds, previewComparing, onPreviewChange]);

    // The board reports when someone edits what's under the open proposal.
    useEffect(() => {
        setPreview((prev) => (prev && prev.stale !== previewIsStale ? { ...prev, stale: previewIsStale } : prev));
    }, [previewIsStale]);

    const reviewFieldsFrom = (data) => ({
        token: data.token,
        diff: data.diff,
        opsPreview: data.opsPreview,
        accepted: initiallyAcceptedIndexes(data.opsPreview),
        autoRepairs: data.autoRepairs,
        lints: data.lints,
        skippedOps: data.skippedOps,
        tainted: data.tainted,
        stale: false,
        notice: null,
        busy: false,
    });

    const runTurn = async (message, conversationId, extra = {}) => {
        const controller = new AbortController();
        abortRef.current = controller;
        const startedAt = Date.now();
        traceRowsRef.current = [];
        setPending({ rows: [], startedAt, turnId: null });
        const finishTrace = () => {
            setPending(null);
            return { rows: traceRowsRef.current, elapsedMs: Date.now() - startedAt };
        };
        try {
            const { data } = await axiosInstance.post(
                `/api/ai/${shareId}/turn`,
                {
                    message,
                    conversationId,
                    selection,
                    viewport: getViewportBounds?.() ?? null,
                    review: autoApply ? "auto" : "preview",
                    ...extra,
                },
                { ...authHeaders, signal: controller.signal, timeout: TURN_TIMEOUT_MS },
            );
            const trace = finishTrace();
            if (data.status === "ambiguous") {
                setMessages((prev) => {
                    const index = prev.length;
                    setLive((current) => ({ ...current, [index]: { fresh: true, trace, choiceOpen: true } }));
                    setDisambiguation({ instruction: message, candidates: data.candidates, messageIndex: index });
                    return [...prev, { role: "assistant", createdAt: Date.now(), content: data.question, ambiguous: true, candidates: data.candidates }];
                });
                return;
            }
            if (data.status === "planned") {
                setMessages((prev) => {
                    const index = prev.length;
                    setLive((current) => ({ ...current, [index]: { fresh: true, trace, previewOpen: true } }));
                    setPreview({ ...reviewFieldsFrom(data), messageIndex: index, focusedIds: null, comparing: false });
                    return [
                        ...prev,
                        {
                            role: "assistant",
                            createdAt: Date.now(),
                            content: data.message,
                            proposal: true,
                            token: data.token,
                            opsPreview: data.opsPreview,
                            diff: data.diff,
                            lints: data.lints,
                        },
                    ];
                });
                return;
            }
            appendAssistant(
                {
                    content: data.message,
                    diff: data.diff,
                    batchId: data.batchId,
                    title: data.title,
                    nodes: data.nodes,
                    edges: data.edges,
                    groups: data.groups,
                    style: data.style,
                    replaces: data.replaces,
                    parts: data.parts,
                    title: data.title,
                    help: data.status === "help",
                    refused: data.status === "refused",
                    canceled: data.status === "canceled",
                },
                { trace },
            );
        } catch (error) {
            const trace = finishTrace();
            if (isAbort(error)) {
                appendAssistant({ content: "Stopped." }, { trace });
                return;
            }
            appendAssistant(
                {
                    content: describeRequestFailure(error, "That didn't work. Your board hasn't changed."),
                    failed: true,
                    traceId: error.response?.data?.traceId,
                },
                { trace },
            );
        } finally {
            abortRef.current = null;
        }
    };

    const closeOpenCards = () => {
        if (preview) {
            axiosInstance.delete(`/api/ai/${shareId}/edit/preview/${preview.token}`, authHeaders).catch(() => {});
            patchLive(preview.messageIndex, { previewOpen: false, resolution: "discarded" });
            setPreview(null);
        }
        if (disambiguation) {
            patchLive(disambiguation.messageIndex, { choiceOpen: false });
            setDisambiguation(null);
        }
    };

    const send = async (text) => {
        if (!text || pending || !shareId || !token || !canEdit) return;

        // A bare number answers an open "which one?" by position, the
        // same choice clicking the matching canvas badge makes.
        if (disambiguation && /^[1-9]\d*$/.test(text)) {
            const candidate = disambiguation.candidates[Number(text) - 1];
            if (candidate) {
                setMessages((prev) => [...prev, { role: "user", content: text, createdAt: Date.now() }]);
                chooseCandidate(candidate.ref);
                return;
            }
        }

        closeOpenCards();
        let conversationId;
        try {
            conversationId = await chats.ensureConversation(text);
        } catch (error) {
            showToast?.error("Error", describeRequestFailure(error, "Couldn't start a new chat."));
            return;
        }
        pinToBottom();
        setMessages((prev) => [...prev, { role: "user", content: text, createdAt: Date.now() }]);
        await runTurn(text, conversationId);
        chats.touch(conversationId);
    };

    const chooseCandidate = async (ref) => {
        if (!disambiguation) return;
        const { instruction, messageIndex } = disambiguation;
        patchLive(messageIndex, { choiceOpen: false });
        setDisambiguation(null);
        await runTurn(instruction, activeId, { clarifiedRef: ref });
    };

    useEffect(() => {
        if (!disambiguation) {
            onDisambiguationChange?.(null);
            return;
        }
        onDisambiguationChange?.({
            candidates: disambiguation.candidates,
            focusedRef: disambiguation.focusedRef ?? null,
            onChoose: (ref) => chooseCandidate(ref),
            onCancel: () => {
                patchLive(disambiguation.messageIndex, { choiceOpen: false });
                setDisambiguation(null);
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disambiguation]);

    const patchPreview = (patch) => setPreview((prev) => (prev ? { ...prev, ...patch } : prev));

    const applyPreview = async (acceptedIndexes) => {
        if (!preview) return;
        const { token: previewToken, messageIndex } = preview;
        patchPreview({ busy: true, notice: null });
        try {
            const { data } = await axiosInstance.post(
                `/api/ai/${shareId}/edit/commit`,
                { token: previewToken, acceptedIndexes, conversationId: activeId },
                authHeaders,
            );
            setPreview(null);
            patchLive(messageIndex, { previewOpen: false, resolution: "applied" });
            appendAssistant({ content: data.message, diff: data.diff, batchId: data.batchId });
        } catch (error) {
            const response = error.response?.data;
            if (response?.stillOpen) {
                patchPreview({ busy: false, notice: response.message, stale: error.response.status === 409 });
                return;
            }
            setPreview(null);
            patchLive(messageIndex, { previewOpen: false, resolution: "failed" });
            appendAssistant({ content: describeRequestFailure(error, "Couldn't apply that edit."), failed: true });
        }
    };

    // Redoes the same instruction against the board as it is now, without
    // asking the model again.
    const updatePreview = async () => {
        if (!preview) return;
        const { token: previewToken, messageIndex } = preview;
        patchPreview({ busy: true, notice: null });
        try {
            const { data } = await axiosInstance.post(`/api/ai/${shareId}/edit/rebase`, { token: previewToken }, authHeaders);
            if (data.status === "planned") {
                setPreview((prev) => ({ ...prev, ...reviewFieldsFrom(data) }));
                return;
            }
            setPreview(null);
            patchLive(messageIndex, { previewOpen: false, resolution: "failed" });
            appendAssistant({ content: data.message });
        } catch (error) {
            setPreview(null);
            patchLive(messageIndex, { previewOpen: false, resolution: "failed" });
            appendAssistant({ content: describeRequestFailure(error, "Couldn't update that proposal."), failed: true });
        }
    };

    const revertEdit = async (batchId) => {
        try {
            const { data } = await axiosInstance.post(`/api/ai/${shareId}/edit/revert`, { batchId, conversationId: activeId }, authHeaders);
            setMessages((prev) => prev.map((message) => (message.batchId === batchId ? { ...message, revertedAt: Date.now() } : message)));
            appendAssistant({ content: data.message });
        } catch (error) {
            showToast?.error("Error", describeRequestFailure(error, "Couldn't undo that edit."));
        }
    };

    const discardPreview = () => {
        if (!preview) return;
        axiosInstance.delete(`/api/ai/${shareId}/edit/preview/${preview.token}`, authHeaders).catch(() => {
            // Best-effort: the token expires on its own with no board effect.
        });
        patchLive(preview.messageIndex, { previewOpen: false, resolution: "discarded" });
        setPreview(null);
    };

    const stop = async () => {
        if (pending?.turnId) {
            // The server records the cancellation in the thread and answers
            // the in-flight request with it, so no client-side abort here.
            await axiosInstance.post(`/api/ai/${shareId}/edit/cancel/${pending.turnId}`, {}, authHeaders).catch(() => abortRef.current?.abort());
            return;
        }
        abortRef.current?.abort();
    };

    const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
    const retry = () => {
        const prompt = messages[lastUserIndex]?.content;
        if (prompt) send(prompt);
    };

    const startNewChat = () => {
        closeOpenCards();
        chats.startNew();
        setHistoryOpen(false);
    };

    const openChat = (id) => {
        closeOpenCards();
        chats.open(id);
        setHistoryOpen(false);
    };

    const diagramElements = useMemo(() => {
        const built = {};
        messages.forEach((message, index) => {
            if (message.role !== "assistant" || live[index]?.discarded) return;
            if (message.nodes?.length) built[index] = buildPreviewElements(message, live[index]?.chosenStyle ?? message.chosenStyle ?? message.style);
            else if (sketchPartsOf(message)) built[index] = buildSketchPreviewElements(sketchPartsOf(message));
        });
        return built;
    }, [messages, live]);

    const empty = messages.length === 0 && !chats.loading;
    const activeTitle = chats.conversations.find((c) => c.id === activeId)?.title || "New chat";
    const recents = chats.conversations.map((c) => ({ id: c.id, label: c.title || "Untitled chat" }));

    return {
        mounted,
        activeId,
        activeTitle,
        applyPreview,
        autoApply,
        chats,
        chooseCandidate,
        closing,
        composerHeight,
        composerRef,
        contentRef,
        diagramElements,
        disambiguation,
        discardPreview,
        empty,
        expanded,
        historyOpen,
        lastUserIndex,
        live,
        messages,
        openChat,
        patchLive,
        patchPreview,
        pending,
        pinned,
        preview,
        recents,
        retry,
        revertEdit,
        scrollRef,
        selection,
        send,
        setAutoApplyPreference,
        setDisambiguation,
        setExpanded,
        setHistoryOpen,
        setIgnoreSelection,
        setPreviewComparing,
        setPreviewFocus,
        setSettingsOpen,
        settingsOpen,
        settingsRef,
        startNewChat,
        stop,
        updatePreview,
    };
}
