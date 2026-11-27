import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL;
const SNAPSHOT_REFRESH_MS = 30 * 1000;

const inFrame = (frameId) => (id, element) => !frameId || id === frameId || element?.frameId === frameId;

// A pinned version never changes; a live one follows the watch room (`via` "embed" or "link"), or past the
// viewer cap re-reads a snapshot every 30 seconds. A signed-in commenter also joins the board for its comments.
export default function useEmbedScene({ shareId, frameId, version, token, via = "embed" }) {
    const [scene, setScene] = useState({ status: "loading" });
    const [elements, setElements] = useState({});
    const [comments, setComments] = useState([]);
    const [mode, setMode] = useState(version ? "pinned" : "live");
    const socketRef = useRef(null);
    const onChangeRef = useRef(() => {});
    const elementsRef = useRef(elements);
    elementsRef.current = elements;

    const load = useCallback(async () => {
        const query = new URLSearchParams(Object.entries({ frame: frameId, version }).filter(([, value]) => value));
        const response = await fetch(`${API}/api/embed/${encodeURIComponent(shareId)}/scene?${query}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => null);
        if (!response) return setScene({ status: "error" });
        if (response.status === 401 || response.status === 403) return setScene({ status: "signIn" });
        if (response.status === 404) return setScene({ status: "missing" });
        if (!response.ok) return setScene({ status: "error" });
        const data = await response.json();
        setElements(data.elements);
        setScene({ status: "ready", ...data });
        return undefined;
    }, [shareId, frameId, version, token]);

    useEffect(() => {
        load();
    }, [load]);

    const ready = scene.status === "ready";
    const canComment = ready && scene.canComment && Boolean(token);

    useEffect(() => {
        if (!ready || version) return undefined;
        const socket = io(API, { auth: token ? { token } : { watchOnly: true }, transports: ["websocket"] });
        socketRef.current = socket;
        const keep = inFrame(frameId);
        // Ids live events changed before the joining snapshot arrived: the
        // server may have read the board before those changes, so they win.
        let changedBeforeSnapshot = null;
        const upsert = ({ elementId, element }) => {
            if (!keep(elementId, element)) return;
            changedBeforeSnapshot?.add(elementId);
            setElements((current) => ({ ...current, [elementId]: element }));
            onChangeRef.current([elementId]);
        };
        const applyJoiningSnapshot = ({ elements: latest = {}, background } = {}) => {
            const touched = changedBeforeSnapshot ?? new Set();
            changedBeforeSnapshot = null;
            const shown = Object.fromEntries(Object.entries(latest).filter(([id, element]) => keep(id, element)));
            const before = elementsRef.current;
            const missed = [...new Set([...Object.keys(before), ...Object.keys(shown)])].filter(
                (id) => !touched.has(id) && JSON.stringify(before[id]) !== JSON.stringify(shown[id]),
            );
            if (background) setScene((current) => ({ ...current, background }));
            if (missed.length === 0) return;
            setElements((current) => {
                const next = { ...current };
                for (const id of missed) {
                    if (shown[id]) next[id] = shown[id];
                    else delete next[id];
                }
                return next;
            });
            onChangeRef.current(missed);
        };
        socket.on("connect", () => {
            changedBeforeSnapshot = new Set();
            socket.emit("watch:start", { shareId, via });
        });
        socket.on("watch:live", (snapshot) => {
            setMode("live");
            applyJoiningSnapshot(snapshot);
        });
        socket.on("watch:snapshotOnly", () => setMode("snapshot"));
        socket.on("watch:refused", load);
        socket.on("server:addNewElement", upsert);
        socket.on("server:updateElement", upsert);
        socket.on("server:deleteElement", ({ elementId }) => {
            changedBeforeSnapshot?.add(elementId);
            setElements((current) => {
                if (!current[elementId]) return current;
                const next = { ...current };
                delete next[elementId];
                return next;
            });
            onChangeRef.current([elementId]);
        });
        socket.on("server:backgroundUpdated", ({ background }) => setScene((current) => ({ ...current, background })));
        if (canComment) {
            socket.on("connect", () => socket.emit("client:joinRoom", { shareId }));
            socket.on("server:joinedRoom", (joined) => setComments(joined.comments ?? []));
            socket.on("server:commentAdded", (comment) => setComments((current) => [...current.filter((c) => c._id !== comment._id), comment]));
            socket.on("server:commentUpdated", (comment) => setComments((current) => current.map((c) => (c._id === comment._id ? comment : c))));
            socket.on("server:commentDeleted", ({ commentId }) => setComments((current) => current.filter((c) => c._id !== commentId)));
        }
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [ready, version, token, shareId, frameId, canComment, load, via]);

    useEffect(() => {
        if (mode !== "snapshot") return undefined;
        const timer = setInterval(load, SNAPSHOT_REFRESH_MS);
        return () => clearInterval(timer);
    }, [mode, load]);

    const addComment = useCallback((anchor, text) => socketRef.current?.emit("client:addComment", { shareId, anchor, text }), [shareId]);
    const onChange = useCallback((listener) => {
        onChangeRef.current = listener;
    }, []);

    return { scene, elements, comments, mode, canComment, addComment, onChange, reload: load };
}
