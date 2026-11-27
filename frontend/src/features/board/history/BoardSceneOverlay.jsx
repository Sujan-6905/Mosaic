import { useEffect, useRef } from "react";
import { drawSceneStatic } from "../rendering/staticSceneRenderer";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "../camera/viewport";
import useViewportSize from "../camera/useViewportSize";
import styles from "./BoardSceneOverlay.module.css";

const FIT_PADDING_PX = 120;

// A past state at full size on a read-only canvas above the live board, which it never touches.
// `cameraElements` holds the view steady as `elements` changes; `leftInset` clears a docked panel.
export default function BoardSceneOverlay({ elements, background, cameraElements, leftInset = 0, label, onClose }) {
    const canvasRef = useRef(null);
    const { width, height } = useViewportSize();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !width || !height) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);

        const bounds = getUnionBounds(Object.values(cameraElements ?? elements));
        const camera = cameraToFit(bounds, width - leftInset, height, FIT_PADDING_PX, { clamp: false }) || { x: 0, y: 0, zoom: 1 };
        // drawSceneStatic sets its own transform from the camera, so the pixel
        // ratio goes in through the zoom and pan it's handed.
        const scaled = { x: camera.x - leftInset / camera.zoom, y: camera.y, zoom: camera.zoom * ratio };
        drawSceneStatic(context, elements, background || { type: "blank", colorToken: null }, scaled, width * ratio, height * ratio);
    }, [elements, cameraElements, background, leftInset, width, height]);

    return (
        <div className={styles.overlay} data-board-chrome>
            <canvas ref={canvasRef} className={styles.canvas} aria-label={label} role="img" />
            <div className={styles.banner} role="status">
                <span className={styles.bannerDot} aria-hidden="true" />
                {label}
                <button type="button" className={styles.bannerClose} onClick={onClose}>
                    Back to live board
                </button>
            </div>
        </div>
    );
}
