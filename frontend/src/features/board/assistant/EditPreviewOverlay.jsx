import { useEffect, useRef } from "react";
import { drawDiffMarker, drawStaticElement } from "../rendering/staticSceneRenderer";
import styles from "./EditPreviewOverlay.module.css";

const ADDED_COLOR = "#22c55e";
const REMOVED_COLOR = "#ef4444";
const MOVED_COLOR = "#3b82f6";
const MODIFIED_COLOR = "#f97316";
const REMOVED_OPACITY = 0.35;

// A proposed edit drawn as it would really look, outlined like the branch diff. The board hides what it
// replaces, so this is their only copy on screen; it takes no pointer events.
const EditPreviewOverlay = ({ diff, elements, focusedIds, camera, viewportWidth, viewportHeight }) => {
    const canvasRef = useRef(null);

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !diff) return;
        const context = canvas.getContext("2d");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(camera.zoom * dpr, 0, 0, camera.zoom * dpr, -camera.x * camera.zoom * dpr, -camera.y * camera.zoom * dpr);

        const drawReal = (element) => drawStaticElement(context, element, elements, camera.zoom, null);
        const isDimmed = (elementId) => focusedIds && !focusedIds.includes(elementId);
        const withFocus = (elementId, paint) => {
            context.save();
            if (isDimmed(elementId)) context.globalAlpha = 0.25;
            paint();
            context.restore();
        };

        diff.removed.forEach(({ elementId, element }) =>
            withFocus(elementId, () => {
                context.save();
                context.globalAlpha *= REMOVED_OPACITY;
                drawReal(element);
                context.restore();
                drawDiffMarker(context, element, REMOVED_COLOR, { dashed: true });
            }),
        );
        diff.moved.forEach(({ elementId, before, after }) =>
            withFocus(elementId, () => {
                drawReal(after);
                drawDiffMarker(context, before, MOVED_COLOR, { dashed: true });
                drawDiffMarker(context, after, MOVED_COLOR);
            }),
        );
        diff.modified.forEach(({ elementId, after }) =>
            withFocus(elementId, () => {
                drawReal(after);
                drawDiffMarker(context, after, MODIFIED_COLOR);
            }),
        );
        diff.added.forEach(({ elementId, element }) =>
            withFocus(elementId, () => {
                drawReal(element);
                drawDiffMarker(context, element, ADDED_COLOR);
            }),
        );
    }, [diff, elements, focusedIds, camera, viewportWidth, viewportHeight, dpr]);

    if (!diff) return null;

    return <canvas ref={canvasRef} className={styles.overlay} width={viewportWidth * dpr} height={viewportHeight * dpr} />;
};

export default EditPreviewOverlay;
