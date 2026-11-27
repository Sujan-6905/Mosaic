import { useEffect, useRef } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Select from "@/components/ui/Select";
import { useReplayTimeline } from "./useReplayTimeline";
import styles from "./ReplayPanel.module.css";

const SPEEDS = [1, 2, 4, 8];

// Sends each frame to the read-only overlay, framed on the final state so the view doesn't jump.
const ReplayPanel = ({ isOpen, onClose, shareId, token, onScene, showToast }) => {
    const { timeline, loading, frame, finalElements, playheadSeq, seek, playing, setPlaying, speed, setSpeed, authorFilter, setAuthorFilter } =
        useReplayTimeline({ isOpen, shareId, token, onError: () => showToast?.error("Error", "Failed to load replay history.") });

    const firstSeq = timeline?.firstSeq ?? 0;
    const latestSeq = timeline?.latestSeq ?? 0;
    const hasHistory = latestSeq > 0;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!isOpen || !hasHistory) {
            onScene?.(null);
            return;
        }
        if (!frame) return;
        onScene?.({
            elements: frame.elements,
            background: frame.background,
            cameraElements: finalElements,
            label: `Replay: change ${playheadSeq} of ${latestSeq}`,
            onClose: () => onCloseRef.current(),
        });
    }, [isOpen, hasHistory, frame, finalElements, playheadSeq, latestSeq, onScene]);

    if (!isOpen) return null;

    const togglePlaying = () => {
        if (!playing && playheadSeq >= latestSeq) seek(firstSeq);
        setPlaying(!playing);
    };

    return (
        <div className={styles.bar} data-board-chrome data-tour="replay-bar">
            {loading && <p className={styles.status}>Loading replay history…</p>}
            {!loading && timeline && !hasHistory && (
                <p className={styles.status}>This board has no recorded history yet. Make an edit, then reopen replay to scrub through it.</p>
            )}

            <div className={styles.controls}>
                <button
                    type="button"
                    className={styles.play}
                    aria-label={playing ? "Pause replay" : "Play replay"}
                    onClick={togglePlaying}
                    disabled={loading || !hasHistory}
                >
                    {playing ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7 4l13 8-13 8z" />
                        </svg>
                    )}
                </button>
                <span className={styles.seqLabel}>
                    {playheadSeq} / {latestSeq}
                </span>
                <input
                    type="range"
                    min={firstSeq}
                    max={latestSeq}
                    value={playheadSeq}
                    aria-label="Replay position"
                    onChange={(e) => seek(Number(e.target.value))}
                    className={styles.slider}
                    disabled={loading || !hasHistory}
                />
                <Select
                    ariaLabel="Show changes by"
                    value={authorFilter || ""}
                    onChange={(id) => setAuthorFilter(id || null)}
                    options={[{ value: "", label: "Everyone" }, ...(timeline?.authors ?? []).map(({ id, name }) => ({ value: id, label: name }))]}
                />
                <Select ariaLabel="Playback speed" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))} />
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close replay">
                    <StrokeIcon name="close" size={14} strokeWidth={2.4} />
                </button>
            </div>

            {timeline?.moments.length > 0 && (
                <div className={styles.momentsRow}>
                    <span className={styles.jumpLabel}>Jump to</span>
                    {timeline.moments.map((moment) => (
                        <button key={`${moment.seq}-${moment.label}`} type="button" className={styles.momentChip} onClick={() => seek(moment.seq)}>
                            {moment.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReplayPanel;
