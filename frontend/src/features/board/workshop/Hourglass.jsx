import styles from "./Hourglass.module.css";

const TILES = 12;
const COLS = 4;
const PITCH = 5;
const LOWER_TOP = 17;

const upperSlot = (n) => ({ x: (n % COLS) * PITCH, y: Math.floor(n / COLS) * PITCH });
const lowerSlot = (n) => ({ x: (n % COLS) * PITCH, y: LOWER_TOP + (2 - Math.floor(n / COLS)) * PITCH });

// A timer's sand as twelve gold tiles: they leave the upper chamber one by one and stack in the lower.
export default function Hourglass({ progress, urgent }) {
    const left = Math.ceil(Math.max(0, Math.min(1, progress)) * TILES);
    const fallen = TILES - left;
    return (
        <svg className={styles.glass} data-urgent={urgent || undefined} viewBox="-1 -1 21 33" width="18" height="28" aria-hidden="true">
            <path className={styles.frame} d="M-0.5 -0.5H19.5V13L11.5 15.5L19.5 18V31.5H-0.5V18L7.5 15.5L-0.5 13Z" />
            {Array.from({ length: left }, (_unused, n) => {
                const at = upperSlot(n);
                return <rect key={`u${n}`} className={styles.sand} x={at.x} y={at.y} width="4" height="4" rx="0.8" />;
            })}
            {Array.from({ length: fallen }, (_unused, n) => {
                const at = lowerSlot(n);
                const newest = n === fallen - 1;
                return (
                    <rect
                        key={`l${n}-${newest ? fallen : ""}`}
                        className={newest ? styles.falling : styles.settled}
                        x={at.x}
                        y={at.y}
                        width="4"
                        height="4"
                        rx="0.8"
                        style={newest ? { "--drop": `${at.y - 13}px` } : undefined}
                    />
                );
            })}
        </svg>
    );
}
