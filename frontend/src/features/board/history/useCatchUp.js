import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { sinceForRange } from "./catchUp";

// Opens by itself only when someone comes back to changes they haven't seen.
// Asking for it later never does, since by then they've chosen to look.
const useCatchUp = ({ shareId, token, roomJoined }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [digest, setDigest] = useState(null);
    const [range, setRange] = useState("visit");
    const [loading, setLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [focusedChangeId, setFocusedChangeId] = useState(null);
    const [summary, setSummary] = useState({ status: "idle", text: null });
    const checkedShareIdRef = useRef(null);
    const requestIdRef = useRef(0);

    const load = useCallback(
        async (nextRange) => {
            const requestId = ++requestIdRef.current;
            setLoading(true);
            setLoadFailed(false);
            setFocusedChangeId(null);
            setSummary({ status: "idle", text: null });
            const since = sinceForRange(nextRange);
            try {
                const { data } = await axiosInstance.get(`/api/drawing/catch-up/${shareId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: since ? { since } : {},
                });
                if (requestId !== requestIdRef.current) return null;
                setDigest(data.digest);
                return data.digest;
            } catch {
                if (requestId === requestIdRef.current) setLoadFailed(true);
                return null;
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        },
        [shareId, token],
    );

    useEffect(() => {
        if (!roomJoined || !shareId || !token || checkedShareIdRef.current === shareId) return;
        checkedShareIdRef.current = shareId;
        load("visit").then((found) => {
            if (found) setIsOpen(true);
        });
    }, [roomJoined, shareId, token, load]);

    const chooseRange = useCallback(
        (nextRange) => {
            setRange(nextRange);
            load(nextRange);
        },
        [load],
    );

    const open = useCallback(() => {
        setIsOpen(true);
        if (!digest) load(range);
    }, [digest, load, range]);

    const close = useCallback(() => {
        setIsOpen(false);
        setFocusedChangeId(null);
    }, []);

    const summarize = useCallback(async () => {
        if (!digest) return;
        setSummary({ status: "loading", text: null });
        try {
            const { data } = await axiosInstance.post(
                `/api/ai/${shareId}/catch-up/summary`,
                { since: digest.since },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            setSummary(
                data.summary
                    ? { status: "done", text: data.summary }
                    : { status: "failed", text: "Couldn't write a summary for this. The list below is still accurate." },
            );
        } catch (error) {
            setSummary({ status: "failed", text: error.response?.data?.message || "Couldn't write a summary just now. The list below is still accurate." });
        }
    }, [digest, shareId, token]);

    return { isOpen, digest, range, loading, loadFailed, focusedChangeId, summary, open, close, chooseRange, setFocusedChangeId, summarize };
};

export default useCatchUp;
