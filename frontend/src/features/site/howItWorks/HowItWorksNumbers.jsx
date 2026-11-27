import { useRef } from "react";
import { useCountUp, useRevealOnce } from "./useRevealOnce";
import styles from "./HowItWorksNumbers.module.css";

export const GOLD_TONES = ["#ffb43c", "#ffd27a", "#e09a2c", "#c07d1c", "#f2c56b"];

// Log scale from 1 ms to 10,000 ms, so each tick is ten times the last.
const logPosition = (ms) => (Math.log10(ms) / 4) * 100;
const TICKS = [
    ["1 ms", 1],
    ["10", 10],
    ["100", 100],
    ["1k", 1000],
    ["10k ms", 10000],
];

const FIELD = (() => {
    let seed = 13;
    const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    return Array.from({ length: 300 }, () => (rand() < 0.2 ? GOLD_TONES[Math.floor(rand() * GOLD_TONES.length)] : null));
})();

const FRAME_TIME_BEFORE_MS = 1071;
const FRAME_TIME_AFTER_MS = 6.2;
const FRAME_BUDGET_MS = 16.7;

export function FrameTimeCard() {
    const [ref, reveal] = useRevealOnce();
    const before = useCountUp(FRAME_TIME_BEFORE_MS, reveal, 1800);
    const after = useCountUp(FRAME_TIME_AFTER_MS, reveal, 700, 1);

    return (
        <article ref={ref} className={`${styles.card} ${styles.chartCard}`} data-reveal={reveal}>
            <div className={styles.chartHead}>
                <div>
                    <span className={styles.cardLabel}>p95 frame time, panning 9,000 elements zoomed out</span>
                    <span className={styles.cardHint}>Lower is better. Log scale, so each step is ten times the last.</span>
                </div>
                <span className={styles.gain}>170 times faster</span>
            </div>
            <div className={styles.chart} role="img" aria-label="Frame time fell from 1,071 ms to 6.2 ms; the budget is 16.7 ms">
                <div className={styles.budget} style={{ left: `${logPosition(FRAME_BUDGET_MS)}%` }} aria-hidden="true">
                    <span>16.7 ms budget</span>
                </div>
                <div className={styles.bars}>
                    <div className={styles.barRow}>
                        <span className={styles.barLabel}>Before: fills every path each frame</span>
                        <span className={styles.barLine}>
                            <span className={styles.bar} style={{ width: `${logPosition(FRAME_TIME_BEFORE_MS)}%` }} />
                            <strong>{before} ms</strong>
                        </span>
                    </div>
                    <div className={styles.barRow}>
                        <span className={styles.barLabel}>After: cached strokes and bitmap tiles</span>
                        <span className={styles.barLine}>
                            <span className={styles.bar} data-after="true" style={{ width: `${logPosition(FRAME_TIME_AFTER_MS)}%` }} />
                            <strong className={styles.goldValue}>{after} ms</strong>
                        </span>
                    </div>
                </div>
                <div className={styles.axis} aria-hidden="true">
                    {TICKS.map(([label, ms], index) => (
                        <span
                            key={label}
                            style={{
                                left: `${logPosition(ms)}%`,
                                transform: `translateX(${index === 0 ? "0" : index === TICKS.length - 1 ? "-100%" : "-50%"})`,
                            }}
                        >
                            {label}
                        </span>
                    ))}
                </div>
            </div>
            <p className={styles.shortfall}>
                Panning and zooming stay inside the budget up to 20,000 elements. A collaborator editing on every frame still misses it above 9,000, and that
                limit is written down rather than rounded away.
            </p>
        </article>
    );
}

// The viewport frame drifts on its own and follows the pointer on hover, which
// is the point of the card: only what the frame covers gets painted.
export function ElementFieldCard() {
    const [ref, reveal] = useRevealOnce();
    const count = useCountUp(9003, reveal, 1400);
    const frameRef = useRef(null);

    const followPointer = (event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const frame = frameRef.current;
        const x = event.clientX - bounds.left - frame.offsetWidth / 2;
        const y = event.clientY - bounds.top - frame.offsetHeight / 2;
        frame.style.setProperty("--frame-x", `${Math.max(0, Math.min(bounds.width - frame.offsetWidth, x))}px`);
        frame.style.setProperty("--frame-y", `${Math.max(0, Math.min(bounds.height - frame.offsetHeight, y))}px`);
    };

    return (
        <article ref={ref} className={styles.card} data-reveal={reveal}>
            <div className={styles.statHead}>
                <strong className={styles.stat}>{count}</strong>
                <span className={styles.cardHint}>elements on the test board</span>
            </div>
            <div
                className={styles.field}
                role="img"
                aria-label="A dense field of elements with a viewport frame over a small part of it"
                onPointerMove={followPointer}
                onPointerEnter={() => frameRef.current?.setAttribute("data-following", "true")}
                onPointerLeave={() => frameRef.current?.removeAttribute("data-following")}
            >
                {FIELD.map((tone, index) => (
                    <span key={index} className={styles.fieldCell} style={{ "--i": index % 30, ...(tone ? { background: tone } : {}) }} />
                ))}
                <span ref={frameRef} className={styles.fieldFrame} aria-hidden="true" />
            </div>
            <p className={styles.cardNote}>
                A board nobody would fill by hand, so the harness seeds one. Each frame paints only what the viewport covers. Move your pointer over it.
            </p>
        </article>
    );
}

export function BundleCard() {
    const [ref, reveal] = useRevealOnce();
    const size = useCountUp(276, reveal, 1100);

    return (
        <article ref={ref} className={styles.card} data-reveal={reveal}>
            <div className={styles.statHead}>
                <strong className={styles.stat}>{size} KB</strong>
                <span className={styles.cardHint}>of JavaScript on first load, gzipped</span>
            </div>
            <div className={styles.split} role="img" aria-label="The home page downloads first; the editor bundle loads only when a board opens">
                <span className={styles.splitHome}>Home page</span>
                <span className={styles.splitEditor}>Editor, on open</span>
            </div>
            <p className={styles.cardNote}>
                The script a first visit downloads, measured from the production build. The board editor is a separate bundle that arrives only once you open a
                board.
            </p>
        </article>
    );
}

// From benchmark/results/edit-benchmark.md, the latest full run: top-1 resolution per category.
const RESOLUTION_BY_CATEGORY = [
    ["Multi-step", 100],
    ["Freehand", 87.5],
    ["Named", 85.7],
    ["Groups", 62.5],
    ["Spatial", 60],
];

export function EditBenchmarkCard() {
    const [ref, reveal] = useRevealOnce();
    const topThree = useCountUp(97.8, reveal, 1300, 1);

    return (
        <article ref={ref} className={`${styles.card} ${styles.wideCard} ${styles.benchCard}`} data-reveal={reveal}>
            <div className={styles.benchSummary}>
                <strong className={styles.stat}>{topThree}%</strong>
                <span className={styles.cardHint}>of 54 plain-language edits found the right shapes in the top three</span>
                <p className={styles.cardNote}>
                    The first guess is right 78.3% of the time and every refusal is correct. Phrases about position are the weakest, and the benchmark ships in
                    the repository so the number can be checked.
                </p>
            </div>
            <div
                className={styles.categories}
                role="img"
                aria-label="Top choice right: multi-step 100%, freehand 87.5%, named 85.7%, groups 62.5%, spatial 60%"
            >
                {RESOLUTION_BY_CATEGORY.map(([category, percent]) => (
                    <div key={category} className={styles.category}>
                        <span className={styles.categoryLabel}>{category}</span>
                        <span className={styles.categoryTrack}>
                            <span className={styles.categoryBar} style={{ width: `${percent}%` }} />
                        </span>
                        <span className={styles.categoryValue}>{percent}%</span>
                    </div>
                ))}
            </div>
        </article>
    );
}
