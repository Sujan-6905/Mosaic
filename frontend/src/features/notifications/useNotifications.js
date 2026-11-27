import { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { socket } from "@/lib/socket.js";
import { resyncPushSubscription } from "@/lib/webPush";

const POLL_MS = 60 * 1000;

// The signed-in person's inbox: read on mount and whenever the tab comes
// back, pushed live over the board's connection while one is open.
export default function useNotifications(token) {
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

    const refresh = useCallback(() => {
        if (!token) return;
        axiosInstance
            .get("/api/notifications", headers)
            .then(({ data }) => {
                setNotifications(data.notifications);
                setUnread(data.unread);
            })
            .catch(() => {});
    }, [token, headers]);

    useEffect(() => {
        resyncPushSubscription(token);
    }, [token]);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        const onFocus = () => document.visibilityState === "visible" && refresh();
        document.addEventListener("visibilitychange", onFocus);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, [refresh]);

    useEffect(() => {
        const onNotification = (notification) => {
            setNotifications((current) => [notification, ...current.filter((existing) => existing.id !== notification.id)].slice(0, 30));
            setUnread((count) => count + 1);
        };
        socket.on("server:notification", onNotification);
        return () => socket.off("server:notification", onNotification);
    }, []);

    const markRead = useCallback(
        (ids = null) => {
            const marking = new Set(ids ?? notifications.map((notification) => notification.id));
            const newlyRead = notifications.filter((notification) => marking.has(notification.id) && !notification.read).length;
            if (ids && newlyRead === 0) return;
            setNotifications((current) => current.map((notification) => (marking.has(notification.id) ? { ...notification, read: true } : notification)));
            setUnread((count) => (ids ? Math.max(0, count - newlyRead) : 0));
            axiosInstance.post("/api/notifications/read", ids ? { ids } : {}, headers).catch(() => {});
        },
        [notifications, headers],
    );

    return { notifications, unread, markRead, headers };
}
