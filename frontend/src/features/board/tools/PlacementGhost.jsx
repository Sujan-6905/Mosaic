import { useEffect, useMemo, useRef, useState } from "react";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import styles from "./PlacementGhost.module.css";

// StaticCanvasPreview insets by 8% of the short side, so this keeps the ghost at the board's scale.
const PREVIEW_INSET_RATIO = 0.08 / (1 - 2 * 0.08);

// A drawing riding under the pointer until a click puts it down. Listens in the capture phase,
// so the placing press never also starts a gesture on the board.
const PlacementGhost = ({ elements, zoom, onPlace, onCancel }) => {
    const ghostRef = useRef(null);
    const pointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [dpr] = useState(() => window.devicePixelRatio || 1);

    const bounds = useMemo(() => getUnionBounds(elements.map(({ element }) => element)), [elements]);
    const previewElements = useMemo(() => Object.fromEntries(elements.map(({ elementId, element }) => [elementId, element])), [elements]);

    const drawnWidth = (bounds.maxX - bounds.minX) * zoom;
    const drawnHeight = (bounds.maxY - bounds.minY) * zoom;
    const inset = Math.min(drawnWidth, drawnHeight) * PREVIEW_INSET_RATIO;
    const width = Math.max(1, Math.round(drawnWidth + inset * 2));
    const height = Math.max(1, Math.round(drawnHeight + inset * 2));

    useEffect(() => {
        const moveTo = ({ x, y }) => {
            if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        };
        moveTo(pointerRef.current);

        const onPointerMove = (event) => {
            pointerRef.current = { x: event.clientX, y: event.clientY };
            moveTo(pointerRef.current);
        };
        const onPointerDown = (event) => {
            if (event.target.closest?.("[data-board-chrome]")) return;
            event.preventDefault();
            event.stopPropagation();
            onPlace(event.clientX, event.clientY);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onCancel();
            } else if (event.key === "Enter") {
                event.stopPropagation();
                onPlace(pointerRef.current.x, pointerRef.current.y);
            }
        };
        window.addEventListener("pointermove", onPointerMove, true);
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("pointermove", onPointerMove, true);
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [onPlace, onCancel]);

    return (
        <>
            <div ref={ghostRef} className={styles.ghost} style={{ width, height }} aria-hidden="true">
                <div className={styles.frame}>
                    <StaticCanvasPreview
                        elements={previewElements}
                        background={{ type: "blank", colorToken: null }}
                        width={Math.round(width * dpr)}
                        height={Math.round(height * dpr)}
                        className={styles.preview}
                    />
                    <i className={styles.corner} data-at="tl" />
                    <i className={styles.corner} data-at="tr" />
                    <i className={styles.corner} data-at="bl" />
                    <i className={styles.corner} data-at="br" />
                </div>
            </div>
            <div className={styles.hint} role="status" data-board-chrome>
                Click or tap where it should go
                <button type="button" onClick={onCancel}>
                    <kbd>Esc</kbd> Cancel
                </button>
            </div>
        </>
    );
};

export default PlacementGhost;
