import { forwardRef, useImperativeHandle } from "react";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import { createSweptScene } from "./sweptScene";
import styles from "./SweptCard.module.css";

const UNDO_SECONDS = 9;

// A swept board's thumbnail as pieces on the floor of its card; `restore` gathers them home.
export const SweptPieces = forwardRef(function SweptPieces({ snapshot }, ref) {
    const { canvasRef, sceneRef } = useStoneScene(({ calm }) =>
        createSweptScene({
            ...snapshot,
            calm,
            slotColor: getComputedStyle(document.documentElement).getPropertyValue("--color-border-strong").trim() || "#3b4048",
        }),
    );
    useImperativeHandle(ref, () => ({ restore: (done) => sceneRef.current?.restore(done) }), [sceneRef]);
    return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
});

// The moment to undo: a ring that drains while nobody is pointing at the card, then the board is filed away.
export function SweptUndo({ title, onPutBack, onExpired, compact = false }) {
    return (
        <span className={styles.pill} data-compact={compact || undefined} role="status">
            <svg className={styles.clock} viewBox="0 0 24 24" aria-hidden="true">
                <circle className={styles.ring} cx="12" cy="12" r="9" style={{ animationDuration: `${UNDO_SECONDS}s` }} onAnimationEnd={onExpired} />
            </svg>
            <span className={styles.note}>Swept up.</span>
            <button type="button" className={styles.putBack} onClick={onPutBack} aria-label={`Put ${title} back`}>
                Put it back
            </button>
        </span>
    );
}
