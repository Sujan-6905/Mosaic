import { useCallback, useEffect, useRef, useState } from "react";
import { isCalm } from "@/lib/calmMode";
import styles from "./OneMinuteTour.module.css";

// Sixty seconds through the page. `through` stops play their section top to bottom instead of resting on it.
const STOPS = [
    { target: "#top", seconds: 5, caption: "Mosaic is a whiteboard for people who build things together." },
    {
        target: "[data-nav-section='product']",
        seconds: 12,
        through: true,
        caption: "One board: shapes, notes, a diagram the assistant drafted, comments, and everyone's cursor live.",
    },
    { target: "#surface", seconds: 8, caption: "An infinite canvas that only draws what you can see, so it stays quick at thousands of pieces." },
    { target: "#room", seconds: 8, caption: "Everyone in the room edits at once. Two people on one note never lose a word." },
    { target: "#record", seconds: 8, caption: "Every change is kept: replay a board, branch it, and merge it back." },
    { target: "#assist", seconds: 8, caption: "Describe a diagram in a sentence; the layout engine places it, not the model." },
    { target: "#wall", seconds: 6, caption: "Every visitor sets one stone on this wall. You can set yours." },
    { target: "[data-closing]", seconds: 5, caption: "That's the minute. Open a board and fill it together." },
];

const scrollFor = (stop, progress) => {
    const node = document.querySelector(stop.target);
    if (!node) return null;
    const top = node.getBoundingClientRect().top + window.scrollY;
    if (!stop.through) return Math.max(0, top - window.innerHeight * 0.12);
    const travel = Math.max(0, node.offsetHeight - window.innerHeight);
    return top + travel * progress;
};

// Scrolls the landing page itself, one caption per stop, and stops the moment the visitor scrolls.
export default function OneMinuteTour({ onFinish }) {
    const [stop, setStop] = useState(0);
    const [paused, setPaused] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const lastRef = useRef(null);
    const elapsedRef = useRef(0);

    const go = useCallback(
        (index) => {
            if (index >= STOPS.length) {
                onFinish();
                return;
            }
            setStop(index);
            elapsedRef.current = 0;
            setElapsed(0);
            const top = scrollFor(STOPS[index], 0);
            if (top !== null) window.scrollTo({ top, behavior: isCalm() ? "auto" : "smooth" });
        },
        [onFinish],
    );

    useEffect(() => {
        go(0);
    }, [go]);

    useEffect(() => {
        if (paused) return undefined;
        let frame = 0;
        lastRef.current = performance.now();
        const tick = (now) => {
            frame = requestAnimationFrame(tick);
            elapsedRef.current += (now - lastRef.current) / 1000;
            lastRef.current = now;
            const playing = STOPS[stop];
            if (playing.through && elapsedRef.current > 1) {
                const top = scrollFor(playing, Math.min(1, (elapsedRef.current - 1) / (playing.seconds - 2)));
                if (top !== null) window.scrollTo({ top, behavior: "auto" });
            }
            setElapsed(elapsedRef.current);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [paused, stop]);

    useEffect(() => {
        if (elapsed >= STOPS[stop].seconds) go(stop + 1);
    }, [elapsed, stop, go]);

    useEffect(() => {
        const takeOver = () => setPaused(true);
        const onKey = (event) => event.key === "Escape" && onFinish();
        window.addEventListener("wheel", takeOver, { passive: true });
        window.addEventListener("touchmove", takeOver, { passive: true });
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("wheel", takeOver);
            window.removeEventListener("touchmove", takeOver);
            window.removeEventListener("keydown", onKey);
        };
    }, [onFinish]);

    return (
        <div className={styles.tour} role="region" aria-label="One-minute tour">
            <ol className={styles.steps} aria-hidden="true">
                {STOPS.map((item, index) => (
                    <li key={item.target} style={{ flexGrow: item.seconds }}>
                        <span style={{ transform: `scaleX(${index < stop ? 1 : index > stop ? 0 : Math.min(1, elapsed / item.seconds)})` }} />
                    </li>
                ))}
            </ol>
            <p className={styles.caption} aria-live="polite">
                {STOPS[stop].caption}
            </p>
            <div className={styles.controls}>
                <button type="button" onClick={() => setPaused((value) => !value)}>
                    {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" onClick={() => go(stop + 1)}>
                    Next
                </button>
                <button type="button" onClick={onFinish} aria-label="End the tour">
                    Done
                </button>
            </div>
        </div>
    );
}
