import { useEffect, useRef, useState } from "react";
import { isCalm } from "@/lib/calmMode";
import styles from "./Clink.module.css";
import { playSound } from "@/lib/soundKit";

const TOUCH_PX = 14;
const COOLDOWN_MS = 1800;
const SPARKS = 10;

// When this pointer touches someone else's, a ring and sparks in both colours go off where they met;
// each side renders the other's cursor, so both see it.
export default function Clink({ cursors, toScreen, color }) {
    const [bursts, setBursts] = useState([]);
    const latest = useRef({ cursors, toScreen });
    latest.current = { cursors, toScreen };
    const lastClink = useRef(new Map());
    const layerRef = useRef(null);

    useEffect(() => {
        const onMove = (event) => {
            if (isCalm() || !layerRef.current) return;
            const box = layerRef.current.getBoundingClientRect();
            const px = event.clientX - box.left;
            const py = event.clientY - box.top;
            const now = performance.now();
            for (const [socketId, cursor] of Object.entries(latest.current.cursors)) {
                const at = latest.current.toScreen(cursor);
                if (Math.hypot(at.x - px, at.y - py) > TOUCH_PX) continue;
                if (now - (lastClink.current.get(socketId) ?? 0) < COOLDOWN_MS) continue;
                lastClink.current.set(socketId, now);
                const burst = { id: `${socketId}-${now}`, x: (at.x + px) / 2, y: (at.y + py) / 2, colors: [cursor.color, color] };
                setBursts((current) => [...current, burst]);
                playSound("clink");
                setTimeout(() => setBursts((current) => current.filter((item) => item.id !== burst.id)), 900);
            }
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
    }, [color]);

    return (
        <div ref={layerRef} className={styles.layer} aria-hidden="true">
            {bursts.map((burst) => (
                <span key={burst.id} className={styles.clink} style={{ left: burst.x, top: burst.y }}>
                    <i className={styles.ring} />
                    {Array.from({ length: SPARKS }, (_unused, n) => (
                        <i
                            key={n}
                            className={styles.spark}
                            style={{
                                "--angle": `${(n / SPARKS) * 360 + (n % 3) * 11}deg`,
                                "--reach": `${18 + (n % 4) * 7}px`,
                                background: burst.colors[n % 2],
                            }}
                        />
                    ))}
                </span>
            ))}
        </div>
    );
}
