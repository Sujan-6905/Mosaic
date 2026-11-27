import styles from "./ReferenceHighlightOverlay.module.css";
import { worldToScreen } from "../camera/camera";

// Numbered badges over an assistant question's candidates, boxed like a selection but in the brand accent.
const ReferenceHighlightOverlay = ({ candidates, focusedRef, camera, onChoose }) => {
    if (!candidates || candidates.length === 0) return null;

    return (
        <div className={styles.layer}>
            {candidates.map((candidate, index) => {
                const topLeft = worldToScreen(camera, candidate.bounds.minX, candidate.bounds.minY);
                const bottomRight = worldToScreen(camera, candidate.bounds.maxX, candidate.bounds.maxY);
                const width = bottomRight.x - topLeft.x;
                const height = bottomRight.y - topLeft.y;

                return (
                    <button
                        key={candidate.ref}
                        type="button"
                        className={styles.candidate}
                        data-focus={focusedRef ? focusedRef === candidate.ref : undefined}
                        style={{ left: topLeft.x, top: topLeft.y, width, height }}
                        onClick={() => onChoose(candidate.ref)}
                        title={candidate.name}
                    >
                        <span className={styles.badge}>{index + 1}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ReferenceHighlightOverlay;
