import styles from "./Chapters.module.css";

// Flat stand-ins for the 3D chapter assets where WebGL is unavailable, each showing the same idea as its model.

export default function Figure({ kind }) {
    if (kind === "grid") {
        return (
            <svg viewBox="0 0 220 140" className={styles.figureSvg} aria-hidden="true">
                <defs>
                    <pattern id="mosaic-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                        <path d="M18 0H0V18" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.35" />
                    </pattern>
                </defs>
                <rect width="220" height="140" fill="url(#mosaic-grid)" />
                <rect x="46" y="34" width="128" height="72" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <rect x="46" y="34" width="128" height="72" fill="currentColor" opacity="0.06" />
                <circle cx="46" cy="34" r="3" fill="currentColor" />
                <circle cx="174" cy="106" r="3" fill="currentColor" />
                <path d="M8 128 L60 128" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            </svg>
        );
    }

    if (kind === "presence") {
        return (
            <svg viewBox="0 0 220 140" className={styles.figureSvg} aria-hidden="true">
                {[
                    [40, 44],
                    [104, 30],
                    [160, 74],
                    [74, 96],
                ].map(([x, y], index) => (
                    <g key={index} opacity={1 - index * 0.16}>
                        <path d={`M${x} ${y} l0 15 l4 -5 l4 8 l3 -2 l-4 -7 l6 -1 z`} fill="currentColor" />
                        <rect x={x + 14} y={y + 2} width={30 + index * 8} height="7" rx="3.5" fill="currentColor" opacity="0.35" />
                    </g>
                ))}
                <path d="M20 118 C60 96, 120 132, 200 104" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
            </svg>
        );
    }

    if (kind === "timeline") {
        return (
            <svg viewBox="0 0 220 140" className={styles.figureSvg} aria-hidden="true">
                <path d="M16 70 L204 70" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                {[16, 52, 88, 124, 160, 204].map((x, index) => (
                    <g key={x}>
                        <circle cx={x} cy="70" r={index === 3 ? 6 : 3} fill="currentColor" opacity={index === 3 ? 1 : 0.55} />
                        <path d={`M${x} 70 L${x} ${index % 2 ? 44 : 96}`} stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
                    </g>
                ))}
                <path d="M124 70 C150 52, 168 40, 190 34" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
                <circle cx="190" cy="34" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
        );
    }

    if (kind === "agent") {
        return (
            <svg viewBox="0 0 220 140" className={styles.figureSvg} aria-hidden="true">
                <rect x="24" y="26" width="172" height="92" rx="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
                <rect x="44" y="52" width="40" height="26" rx="3" fill="currentColor" opacity="0.18" />
                <rect x="104" y="46" width="52" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M84 65 L104 63" stroke="currentColor" strokeWidth="1" />
                <path d="M150 74 l0 18 l5 -6 l5 9 l3 -2 l-5 -8 l7 -1 z" fill="currentColor" />
                <rect x="166" y="92" width="26" height="8" rx="4" fill="currentColor" opacity="0.5" />
            </svg>
        );
    }

    if (kind === "bubble") {
        return (
            <svg viewBox="0 0 220 140" className={styles.figureSvg} aria-hidden="true">
                <path
                    d="M62 30 H158 a12 12 0 0 1 12 12 V88 a12 12 0 0 1 -12 12 H92 L70 118 L74 100 H62 a12 12 0 0 1 -12 -12 V42 a12 12 0 0 1 12 -12 z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                />
                <path d="M110 44 L115 60 L131 65 L115 70 L110 86 L105 70 L89 65 L105 60 z" fill="currentColor" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 220 140" className={styles.figureSvg} aria-hidden="true">
            {[
                [50, 40, 44, 18],
                [126, 32, 52, 18],
                [40, 92, 50, 18],
                [130, 96, 46, 18],
            ].map(([x, y, w, h]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
            ))}
            <path d="M94 49 L126 41 M72 58 L64 92 M90 101 L130 105 M152 50 L153 96" stroke="currentColor" strokeWidth="1" opacity="0.6" />
            <circle cx="110" cy="70" r="2.5" fill="currentColor" />
        </svg>
    );
}
