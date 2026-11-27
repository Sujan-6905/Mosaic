import { useEffect, useRef } from "react";
import { CHANGE_KIND_COLORS } from "./catchUp";
import styles from "../assistant/EditPreviewOverlay.module.css";

const MARKER_PADDING = 6;
const FOCUS_RING_PADDING = 14;
// With one change picked out, the rest step back so it is the one the eye finds.
const BACKGROUND_ALPHA = 0.25;
const FOCUS_FILL_ALPHA = 0.14;

// Outlines what changed while someone was away, without touching the board
// itself. A removed element's outline marks where it used to be.
const ChangeMarkersOverlay = ({ changes, focusedChangeId, camera, viewportWidth, viewportHeight }) => {
    const canvasRef = useRef(null);
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !changes) return;
        const context = canvas.getContext("2d");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        const anyFocused = changes.some((change) => change.id === focusedChangeId);
        for (const change of changes) {
            if (!change.bounds) continue;
            const focused = change.id === focusedChangeId;
            const padding = focused ? FOCUS_RING_PADDING : MARKER_PADDING;
            const left = (change.bounds.minX - camera.x) * camera.zoom - padding;
            const top = (change.bounds.minY - camera.y) * camera.zoom - padding;
            const width = (change.bounds.maxX - change.bounds.minX) * camera.zoom + padding * 2;
            const height = (change.bounds.maxY - change.bounds.minY) * camera.zoom + padding * 2;
            context.globalAlpha = anyFocused && !focused ? BACKGROUND_ALPHA : 1;
            context.strokeStyle = CHANGE_KIND_COLORS[change.kind];
            context.lineWidth = focused ? 3 : 1.5;
            context.setLineDash(change.kind === "removed" ? [6, 4] : []);
            if (focused) {
                context.fillStyle = CHANGE_KIND_COLORS[change.kind];
                context.globalAlpha = FOCUS_FILL_ALPHA;
                context.fillRect(left, top, width, height);
                context.globalAlpha = 1;
            }
            context.strokeRect(left, top, width, height);
        }
        context.globalAlpha = 1;
    }, [changes, focusedChangeId, camera, viewportWidth, viewportHeight, dpr]);

    if (!changes) return null;

    return <canvas ref={canvasRef} className={styles.overlay} width={viewportWidth * dpr} height={viewportHeight * dpr} />;
};

export default ChangeMarkersOverlay;
