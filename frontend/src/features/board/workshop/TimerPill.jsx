import { useEffect, useRef, useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Hourglass from "./Hourglass";
import styles from "./WorkshopBar.module.css";

const PRESET_MINUTES = [1, 3, 5, 10, 15];
const MAX_MINUTES = 120;
const TICK_MS = 250;
const URGENT_MS = 10_000;

const formatClock = (ms) => {
    const seconds = Math.ceil(Math.max(0, ms) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const timeLeft = (timer, clockOffset) => (timer.running ? timer.endsAt - (Date.now() + clockOffset) : timer.remainingMs);

// Two soft rising notes; a browser that blocks sound before any click simply stays quiet.
const playChime = () => {
    try {
        const audio = new AudioContext();
        [660, 880].forEach((frequency, i) => {
            const tone = audio.createOscillator();
            const level = audio.createGain();
            const start = audio.currentTime + i * 0.22;
            tone.frequency.value = frequency;
            level.gain.setValueAtTime(0.0001, start);
            level.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
            level.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
            tone.connect(level).connect(audio.destination);
            tone.start(start);
            tone.stop(start + 0.55);
        });
    } catch {
        // No sound available.
    }
};

export const TimerSetup = ({ onStart, onClose }) => {
    const [minutes, setMinutes] = useState(5);
    return (
        <div className={styles.card} role="group" aria-label="Start a timer for everyone on this board">
            <StrokeIcon name="timer" size={16} className={styles.cardIcon} />
            <div className={styles.presets} role="radiogroup" aria-label="Minutes">
                {PRESET_MINUTES.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        role="radio"
                        aria-checked={minutes === preset}
                        className={styles.chip}
                        onClick={() => setMinutes(preset)}
                    >
                        {preset}m
                    </button>
                ))}
            </div>
            <label className={styles.minutes}>
                <input
                    type="number"
                    min={1}
                    max={MAX_MINUTES}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.min(MAX_MINUTES, Math.max(1, Number(e.target.value) || 1)))}
                    aria-label="Minutes"
                />
                <span>min</span>
            </label>
            <button type="button" className={styles.primary} onClick={() => onStart(minutes * 60_000)}>
                Start
            </button>
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close timer setup">
                <StrokeIcon name="close" size={13} strokeWidth={2.4} />
            </button>
        </div>
    );
};

export const TimerPill = ({ timer, clockOffsetRef, canControl, onChange }) => {
    const [left, setLeft] = useState(() => timeLeft(timer, clockOffsetRef.current));
    const chimedForRef = useRef(null);

    useEffect(() => {
        setLeft(timeLeft(timer, clockOffsetRef.current));
        if (!timer.running) return undefined;
        const tick = setInterval(() => setLeft(timeLeft(timer, clockOffsetRef.current)), TICK_MS);
        return () => clearInterval(tick);
    }, [timer, clockOffsetRef]);

    const done = left <= 0;
    // Chimes only for someone who watched it count down, not for a person who joins after it ended.
    const sawCountingRef = useRef(!done);
    useEffect(() => {
        if (!done) {
            sawCountingRef.current = true;
            return;
        }
        if (!timer.running || !sawCountingRef.current || chimedForRef.current === timer.endsAt) return;
        chimedForRef.current = timer.endsAt;
        playChime();
    }, [done, timer.running, timer.endsAt]);

    const progress = Math.min(1, Math.max(0, left / timer.durationMs));
    return (
        <div
            className={styles.pill}
            data-done={done || undefined}
            role="timer"
            aria-live={done ? "assertive" : "off"}
            aria-label={done ? "Time's up" : `${formatClock(left)} left`}
        >
            <Hourglass progress={progress} urgent={!done && timer.running && left < URGENT_MS} />
            <span className={styles.clock}>{done ? "Time's up" : formatClock(left)}</span>
            {canControl && (
                <>
                    {!done && (
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => onChange(timer.running ? "pause" : "resume")}
                            aria-label={timer.running ? "Pause the timer" : "Resume the timer"}
                        >
                            <StrokeIcon name={timer.running ? "pause" : "resume"} size={13} strokeWidth={2.4} />
                        </button>
                    )}
                    <button type="button" className={styles.textButton} onClick={() => onChange("extend")} aria-label="Add a minute">
                        +1m
                    </button>
                    <button type="button" className={styles.iconButton} onClick={() => onChange("reset")} aria-label="Stop the timer">
                        <StrokeIcon name="close" size={13} strokeWidth={2.4} />
                    </button>
                </>
            )}
        </div>
    );
};
