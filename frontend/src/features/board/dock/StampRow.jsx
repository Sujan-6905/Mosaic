import { STAMP_KINDS } from "../../../../../shared/canvas/elements/stamps.js";
import styles from "./index.module.css";

const StampFace = ({ kind }) => (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={kind.color} />
        {kind.text ? (
            <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={kind.ink}>
                {kind.text}
            </text>
        ) : (
            <path
                d={kind.glyph}
                transform="translate(4.56 4.56) scale(0.62)"
                fill="none"
                stroke={kind.ink}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        )}
    </svg>
);

// Picking a stamp picks the stamp tool; each click on the board then drops one.
export default function StampRow({ activeKind, isActive, onPick }) {
    return (
        <div className={styles.stampRow}>
            <span className={styles.rowText}>
                <span>Stamp</span>
                <span className={styles.rowNote}>React to anything, as often as you like</span>
            </span>
            <div className={styles.stamps} role="group" aria-label="Stamps">
                {STAMP_KINDS.map((kind) => (
                    <button
                        key={kind.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive && activeKind === kind.id}
                        aria-label={`${kind.label} stamp`}
                        title={kind.label}
                        className={styles.stamp}
                        onClick={() => onPick(kind.id)}
                    >
                        <StampFace kind={kind} />
                    </button>
                ))}
            </div>
        </div>
    );
}
