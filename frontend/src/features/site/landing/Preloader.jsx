import { useEffect, useRef, useState } from "react";
import styles from "./Preloader.module.css";

// Holds the page until the hero's type is in memory. The counter follows real loader progress but never
// outruns MIN_DURATION, so a warm cache doesn't flash.

const MIN_DURATION = 1300;

export default function Preloader({ progress, onComplete }) {
    const [shown, setShown] = useState(0);
    const [leaving, setLeaving] = useState(false);
    const startedAt = useRef(null);
    const raf = useRef(null);
    const finished = useRef(false);

    if (startedAt.current === null && typeof performance !== "undefined") {
        startedAt.current = performance.now();
    }

    useEffect(() => {
        let previous = performance.now();
        const tick = (now) => {
            raf.current = requestAnimationFrame(tick);
            // Frame-rate independent and deliberately unclamped: clamping the step would bring back the crawl on slow devices.
            const delta = (now - previous) / 1000;
            previous = now;
            const catchUp = 1 - Math.exp(-7 * delta);
            setShown((current) => {
                // Time-based floor keeps the count climbing steadily even when
                // the assets resolve instantly.
                const elapsed = now - startedAt.current;
                const paced = Math.min(elapsed / MIN_DURATION, 1);
                const target = Math.min(progress, paced) * 100;
                const next = current + (target - current) * catchUp;
                return next > 99.6 ? 100 : next;
            });
        };
        raf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.current);
    }, [progress]);

    useEffect(() => {
        if (finished.current || shown < 99.9) return;
        finished.current = true;
        setLeaving(true);
        const timer = setTimeout(() => onComplete?.(), 700);
        return () => clearTimeout(timer);
    }, [shown, onComplete]);

    const value = Math.round(shown);

    return (
        <div
            className={`${styles.root} ${leaving ? styles.leaving : ""}`}
            role="progressbar"
            aria-label="Loading Mosaic"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div className={styles.grid} aria-hidden="true">
                {Array.from({ length: 12 }).map((_, index) => (
                    <span key={index} className={styles.cell} style={{ "--cell-index": index }} />
                ))}
            </div>

            <div className={styles.top}>
                <span className={styles.mark}>Mosaic</span>
                <span className={styles.label}>Assembling the canvas</span>
            </div>

            <div className={styles.bottom}>
                <span className={styles.counter}>{String(value).padStart(3, "0")}</span>
                <span className={styles.rule} aria-hidden="true">
                    <span className={styles.ruleFill} style={{ transform: `scaleX(${shown / 100})` }} />
                </span>
            </div>
        </div>
    );
}
