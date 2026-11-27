import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import CursorRing from "./CursorRing";
import { StageContext } from "../stage/context";
import styles from "./SitePage.module.css";

const AssetStage = dynamic(() => import("../stage/AssetStage"), { ssr: false });

// The frame every marketing page shares: graphite theme root, trailing cursor, reading-progress rail, and the
// one fixed WebGL canvas each AssetSlot scissors its model into.
export default function SitePage({ children, onStageState }) {
    const progressRef = useRef(null);
    const [stage, setStage] = useState({ controller: null, unavailable: false });

    const handleStageState = useCallback(
        (next) => {
            setStage(next);
            onStageState?.(next);
        },
        [onStageState],
    );

    // Not routed through React state: it updates on every scroll frame and
    // only ever writes one transform.
    useEffect(() => {
        const bar = progressRef.current;
        let frame = 0;
        const write = () => {
            frame = 0;
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            const travelled = scrollable > 0 ? window.scrollY / scrollable : 0;
            bar.style.transform = `scaleX(${Math.min(Math.max(travelled, 0), 1)})`;
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(write);
        };
        write();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, []);

    return (
        <div className={`site-theme ${styles.root}`}>
            <CursorRing />
            <div className={styles.progressRail} aria-hidden="true">
                <span ref={progressRef} className={styles.progressFill} />
            </div>
            <StageContext.Provider value={stage}>
                <AssetStage className={styles.stageCanvas} onState={handleStageState} />
                {children}
            </StageContext.Provider>
        </div>
    );
}
