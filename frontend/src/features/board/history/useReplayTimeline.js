import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { buildReplayCheckpoints, reconstructAtSeq } from "./replayReconstruct";

const MAX_STEP_DELAY_MS = 600;
const SCRUB_FETCH_DELAY_MS = 150;

const toWindow = (data) => ({
    baseSeq: data.baseSeq,
    base: { seq: data.baseSeq, elements: data.elements, background: data.background },
    ops: data.ops,
    endSeq: data.hasMore ? data.ops.at(-1).seq : Number.POSITIVE_INFINITY,
});

const covers = (win, seq) => Boolean(win) && seq >= win.baseSeq && seq <= win.endSeq;

// Loads replay a window at a time and builds frames inside it locally; going past an edge loads the next.
export const useReplayTimeline = ({ isOpen, shareId, token, onError }) => {
    const [timeline, setTimeline] = useState(null);
    const [win, setWin] = useState(null);
    const [finalElements, setFinalElements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [playheadSeq, setPlayheadSeq] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [authorFilter, setAuthorFilter] = useState(null);
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const loadWindow = useCallback(
        (seq, authorId) =>
            axiosInstance
                .get(`/api/drawing/${shareId}/replay/window`, {
                    params: authorId ? { seq, authorId } : { seq },
                    headers: { Authorization: `Bearer ${token}` },
                })
                .then(({ data }) => (data.exhausted ? null : toWindow(data))),
        [shareId, token],
    );

    const fail = useCallback(() => {
        setPlaying(false);
        onErrorRef.current?.();
    }, []);

    useEffect(() => {
        if (!isOpen || !shareId || !token) return undefined;
        let cancelled = false;
        setLoading(true);
        setTimeline(null);
        setWin(null);
        setPlaying(false);
        axiosInstance
            .get(`/api/drawing/${shareId}/replay/timeline`, { headers: { Authorization: `Bearer ${token}` } })
            .then(async ({ data }) => {
                const latest = data.latestSeq > 0 ? await loadWindow(data.latestSeq) : null;
                if (cancelled) return;
                setTimeline(data);
                setWin(latest);
                setFinalElements(latest?.base.elements ?? null);
                setPlayheadSeq(data.latestSeq);
            })
            .catch(() => !cancelled && fail())
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [isOpen, shareId, token, loadWindow, fail]);

    useEffect(() => {
        if (!timeline || playing || covers(win, playheadSeq)) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            loadWindow(playheadSeq)
                .then((next) => !cancelled && setWin(next))
                .catch(() => !cancelled && fail());
        }, SCRUB_FETCH_DELAY_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [timeline, playing, win, playheadSeq, loadWindow, fail]);

    // Waits between changes in proportion to the real gap, capped so an idle
    // stretch in the original session doesn't stall playback.
    useEffect(() => {
        if (!playing) return undefined;
        if (covers(win, playheadSeq)) {
            const next = win.ops.find((op) => op.seq > playheadSeq && (!authorFilter || op.authorId === authorFilter));
            if (next) {
                const current = win.ops.findLast((op) => op.seq <= playheadSeq);
                const delay = Math.max(16, Math.min(MAX_STEP_DELAY_MS, current ? (next.ts - current.ts) / speed : 0));
                const timer = setTimeout(() => setPlayheadSeq(next.seq), delay);
                return () => clearTimeout(timer);
            }
            if (win.endSeq === Number.POSITIVE_INFINITY) {
                setPlaying(false);
                return undefined;
            }
        }
        let cancelled = false;
        loadWindow(playheadSeq, authorFilter)
            .then((following) => {
                if (cancelled) return;
                if (!following) {
                    setPlaying(false);
                    return;
                }
                setWin(following);
                setPlayheadSeq(following.baseSeq);
            })
            .catch(() => !cancelled && fail());
        return () => {
            cancelled = true;
        };
    }, [playing, win, playheadSeq, authorFilter, speed, loadWindow, fail]);

    const checkpoints = useMemo(() => (win ? buildReplayCheckpoints(win.ops, win.base) : null), [win]);
    const frame = useMemo(() => (covers(win, playheadSeq) ? reconstructAtSeq(win.ops, checkpoints, playheadSeq) : null), [win, checkpoints, playheadSeq]);

    const seek = useCallback((seq) => {
        setPlaying(false);
        setPlayheadSeq(seq);
    }, []);

    return {
        timeline,
        loading,
        frame,
        finalElements,
        playheadSeq,
        seek,
        playing,
        setPlaying,
        speed,
        setSpeed,
        authorFilter,
        setAuthorFilter,
    };
};
