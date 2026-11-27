import { useEffect, useRef, useState } from "react";
import styles from "./Preloader.module.css";

// Holds the page only while the hero's type is still loading. Until then the counter creeps toward 90; once the
// type is ready it runs out to 100 quickly, so a warm cache passes straight through.

const CREEP_CEILING = 90;
const CREEP_SECONDS = 1.5;

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
            const delta = (now - previous) / 1000;
            previous = now;
            const ready = progress >= 1;
            const elapsed = (now - startedAt.current) / 1000;
            const target = ready ? 100 : CREEP_CEILING * (1 - Math.exp(-elapsed / CREEP_SECONDS));
            const catchUp = 1 - Math.exp(-(ready ? 14 : 7) * delta);
            setShown((current) => {
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
