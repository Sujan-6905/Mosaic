import { useEffect, useRef, useState } from "react";
import { isCalm } from "@/lib/calmMode";
import { worldToScreen } from "../camera/camera";
import { SHAKEN_LOOSE_EVENT } from "../input/shakeLoose";
import { milestoneCrossed, ordinalPiece, pieceName } from "./milestones";
import { playSound } from "@/lib/soundKit";
import styles from "./BoardRituals.module.css";

const MILESTONE_KEY = "mosaic:milestones";

const readMarked = () => {
    try {
        return JSON.parse(window.localStorage.getItem(MILESTONE_KEY)) ?? {};
    } catch {
        return {};
    }
};

const rememberMarked = (shareId, mark) => {
    try {
        window.localStorage.setItem(MILESTONE_KEY, JSON.stringify({ ...readMarked(), [shareId]: mark }));
    } catch {
        // Without storage a milestone may be marked again on another visit; harmless.
    }
};

const centreOf = (element) => ({ x: (element.startX + element.endX) / 2, y: (element.startY + element.endY) / 2 });

// A stamp lands like a seal pressed into wax, a shape shaken loose throws a puff of dust, and round piece
// counts get a quiet note.
export default function BoardRituals({ elements, camera, shareId }) {
    const [effects, setEffects] = useState([]);
    const [milestone, setMilestone] = useState(null);
    const seenRef = useRef(null);
    const countRef = useRef(null);
    const layerRef = useRef(null);
    const cameraRef = useRef(camera);
    cameraRef.current = camera;

    const flash = (effect, ms) => {
        const id = `${effect.kind}-${performance.now()}-${Math.random()}`;
        setEffects((current) => [...current, { ...effect, id }]);
        setTimeout(() => setEffects((current) => current.filter((item) => item.id !== id)), ms);
    };

    useEffect(() => {
        const ids = Object.keys(elements);
        if (seenRef.current === null) {
            seenRef.current = new Set(ids);
            countRef.current = ids.length;
            return;
        }
        const fresh = ids.filter((id) => !seenRef.current.has(id));
        seenRef.current = new Set(ids);
        const before = countRef.current;
        countRef.current = ids.length;

        const stamps = fresh.map((id) => elements[id]).filter((element) => element?.type === "stamp");
        if (stamps.length > 0) {
            playSound("knock");
            if (!isCalm()) stamps.forEach((stamp) => flash({ kind: "seal", ...worldToScreen(cameraRef.current, centreOf(stamp).x, centreOf(stamp).y) }, 700));
        }

        const mark = milestoneCrossed(before, ids.length);
        if (mark && (readMarked()[shareId] ?? 0) < mark) {
            rememberMarked(shareId, mark);
            setMilestone({ mark, piece: pieceName(elements[fresh.at(-1)]) });
            playSound("chime");
        }
    }, [elements, shareId]);

    useEffect(() => {
        if (!milestone) return undefined;
        const timer = setTimeout(() => setMilestone(null), 6000);
        return () => clearTimeout(timer);
    }, [milestone]);

    useEffect(() => {
        const onShaken = ({ detail }) => {
            playSound("clink");
            if (isCalm() || !layerRef.current) return;
            const box = layerRef.current.getBoundingClientRect();
            flash({ kind: "dust", x: detail.clientX - box.left, y: detail.clientY - box.top }, 800);
        };
        window.addEventListener(SHAKEN_LOOSE_EVENT, onShaken);
        return () => window.removeEventListener(SHAKEN_LOOSE_EVENT, onShaken);
    }, []);

    return (
        <>
            <div ref={layerRef} className={styles.layer} aria-hidden="true">
                {effects.map((effect) => (
                    <span key={effect.id} className={styles[effect.kind]} style={{ left: effect.x, top: effect.y }}>
                        {effect.kind === "dust" && Array.from({ length: 8 }, (_unused, n) => <i key={n} style={{ "--angle": `${n * 45 + 12}deg` }} />)}
                    </span>
                ))}
            </div>
            {milestone && (
                <div className={styles.milestone} role="status">
                    <span className={styles.count}>{milestone.mark.toLocaleString("en-GB")}</span>
                    <span>
                        <strong>pieces on this board</strong>
                        <span>
                            The {ordinalPiece(milestone.mark)} was {milestone.piece}.
                        </span>
                    </span>
                </div>
            )}
        </>
    );
}
