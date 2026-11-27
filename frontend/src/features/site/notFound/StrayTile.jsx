import { useEffect, useRef, useState } from "react";
import { isCalm } from "@/lib/calmMode";
import styles from "./StrayTile.module.css";

const GOLD = ["#ffb43c", "#e09a2c", "#c07d1c"];
const STONE = ["#24282e", "#2e333a", "#1c1f24"];
const SIZE = 7;
const MISSING_INDEX = 24;
const SNAP_DISTANCE = 64;
const SPARKS = 12;

const TILES = (() => {
    let seed = 41;
    const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    return Array.from({ length: SIZE * SIZE }, (_unused, index) => {
        if (index === MISSING_INDEX) return null;
        const palette = rand() < 0.28 ? GOLD : STONE;
        return palette[Math.floor(rand() * 3)];
    });
})();

// Rings out from the gap, so the mend reads as travelling across the picture.
const ringFrom = (index) => Math.max(Math.abs((index % SIZE) - (MISSING_INDEX % SIZE)), Math.abs(Math.floor(index / SIZE) - Math.floor(MISSING_INDEX / SIZE)));

// Drag or press the missing tile and a spring carries it home; dropped elsewhere it drifts back to wait.
// Once home, the picture glints outward from the mend.
export default function StrayTile({ onHome }) {
    const tileRef = useRef(null);
    const gapRef = useRef(null);
    const motion = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, frame: 0, dragging: false, grab: [0, 0] });
    const [home, setHome] = useState(false);

    const paint = () => {
        const m = motion.current;
        const tilt = Math.max(-0.5, Math.min(0.5, m.vx / 1400));
        tileRef.current.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) rotate(${tilt}rad)`;
    };

    // Offset from the tile's resting place to the gap, from layout so the drag's tilt can't skew it.
    const gapOffset = () => [gapRef.current.offsetLeft - tileRef.current.offsetLeft, gapRef.current.offsetTop - tileRef.current.offsetTop];

    const settle = (tx, ty) => {
        const m = motion.current;
        m.tx = tx;
        m.ty = ty;
        cancelAnimationFrame(m.frame);
        if (isCalm()) {
            m.x = tx;
            m.y = ty;
            paint();
            return;
        }
        let last = performance.now();
        const step = (now) => {
            const dt = Math.min(0.033, (now - last) / 1000);
            last = now;
            m.vx += ((m.tx - m.x) * 190 - m.vx * 18) * dt;
            m.vy += ((m.ty - m.y) * 190 - m.vy * 18) * dt;
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            paint();
            if (Math.hypot(m.tx - m.x, m.ty - m.y) < 0.4 && Math.hypot(m.vx, m.vy) < 8) {
                m.x = m.tx;
                m.y = m.ty;
                m.vx = 0;
                m.vy = 0;
                paint();
                return;
            }
            m.frame = requestAnimationFrame(step);
        };
        m.frame = requestAnimationFrame(step);
    };

    const goHome = () => {
        const [gx, gy] = gapOffset();
        setHome(true);
        settle(gx, gy);
        onHome?.();
    };

    const onPointerDown = (event) => {
        if (home) return;
        const m = motion.current;
        cancelAnimationFrame(m.frame);
        m.dragging = true;
        m.moved = false;
        m.grab = [event.clientX - m.x, event.clientY - m.y];
        m.lastAt = performance.now();
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event) => {
        const m = motion.current;
        if (!m.dragging) return;
        const now = performance.now();
        const dt = Math.max(0.008, (now - m.lastAt) / 1000);
        const nx = event.clientX - m.grab[0];
        const ny = event.clientY - m.grab[1];
        m.vx = (nx - m.x) / dt;
        m.vy = (ny - m.y) / dt;
        if (Math.hypot(nx, ny) > 4) m.moved = true;
        m.x = nx;
        m.y = ny;
        m.lastAt = now;
        paint();
    };

    const onPointerUp = () => {
        const m = motion.current;
        if (!m.dragging) return;
        m.dragging = false;
        const [gx, gy] = gapOffset();
        if (!m.moved || Math.hypot(gx - m.x, gy - m.y) < SNAP_DISTANCE) goHome();
        else settle(0, 0);
    };

    useEffect(() => () => cancelAnimationFrame(motion.current.frame), []);

    return (
        <div className={styles.art} data-home={home}>
            <div className={styles.grid} aria-hidden="true">
                {TILES.map((tone, index) =>
                    tone ? (
                        <span key={index} className={styles.tile} style={{ background: tone, "--ring": ringFrom(index) }} />
                    ) : (
                        <span key={index} ref={gapRef} className={styles.gap}>
                            {home &&
                                Array.from({ length: SPARKS }, (_unused, spark) => (
                                    <i
                                        key={spark}
                                        className={styles.spark}
                                        style={{ "--angle": `${(spark / SPARKS) * 360 + (spark % 3) * 9}deg`, "--reach": `${34 + (spark % 4) * 14}px` }}
                                    />
                                ))}
                        </span>
                    ),
                )}
            </div>
            <button
                ref={tileRef}
                type="button"
                className={styles.stray}
                aria-label={home ? "The missing tile is back in place" : "Put the missing tile back"}
                aria-pressed={home}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(event) => {
                    if (!home && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        goHome();
                    }
                }}
            >
                <span className={styles.face} />
            </button>
        </div>
    );
}
