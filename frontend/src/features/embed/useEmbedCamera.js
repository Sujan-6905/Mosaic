import { useCallback, useEffect, useRef, useState } from "react";
import { drawSceneStatic } from "@/features/board/rendering/staticSceneRenderer";
import { getUnionBounds, getElementBounds } from "../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "@/features/board/camera/viewport";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
const FIT_PADDING = 32;
const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

// A read-only canvas that pans by dragging and zooms with the wheel, drawn
// with the board's own painter at the screen's full sharpness.
export default function useEmbedCamera({ elements, background, onCameraChange }) {
    // A callback ref: the canvas appears only once the board has loaded.
    const [canvas, canvasRef] = useState(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [camera, setCamera] = useState(null);
    const drag = useRef(null);
    const lastPressDragged = useRef(false);

    useEffect(() => {
        if (!canvas) return undefined;
        const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [canvas]);

    const fitTo = useCallback(
        (bounds) => {
            if (!bounds || !size.width) return;
            setCamera(cameraToFit(bounds, size.width, size.height, FIT_PADDING, { clamp: false }));
        },
        [size.width, size.height],
    );

    const fit = useCallback(() => fitTo(getUnionBounds(Object.values(elements))), [elements, fitTo]);
    const focusElement = useCallback((elementId) => fitTo(getElementBounds(elements[elementId])), [elements, fitTo]);

    // The first picture of the board shows all of it.
    useEffect(() => {
        if (!camera && size.width && Object.keys(elements).length) fit();
    }, [camera, size.width, elements, fit]);

    useEffect(() => {
        if (!canvas || !camera || !size.width) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);
        const context = canvas.getContext("2d");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawSceneStatic(
            context,
            elements,
            background ?? { type: "blank", colorToken: null },
            { ...camera, zoom: camera.zoom * ratio },
            canvas.width,
            canvas.height,
        );
        onCameraChange?.(camera);
    }, [canvas, elements, background, camera, size, onCameraChange]);

    const zoomAround = useCallback(
        (factor, screenX = size.width / 2, screenY = size.height / 2) => {
            setCamera((current) => {
                if (!current) return current;
                const zoom = clampZoom(current.zoom * factor);
                const worldX = current.x + screenX / current.zoom;
                const worldY = current.y + screenY / current.zoom;
                return { zoom, x: worldX - screenX / zoom, y: worldY - screenY / zoom };
            });
        },
        [size.width, size.height],
    );

    const handlers = {
        onWheel: (event) => {
            const box = event.currentTarget.getBoundingClientRect();
            zoomAround(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - box.left, event.clientY - box.top);
        },
        onPointerDown: (event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, moved: false };
        },
        onPointerMove: (event) => {
            if (!drag.current) return;
            const dx = event.clientX - drag.current.x;
            const dy = event.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
            drag.current.x = event.clientX;
            drag.current.y = event.clientY;
            setCamera((current) => current && { ...current, x: current.x - dx / current.zoom, y: current.y - dy / current.zoom });
        },
        onPointerUp: () => {
            lastPressDragged.current = Boolean(drag.current?.moved);
            drag.current = null;
        },
    };

    // Where on the board a click in the canvas landed, unless it was the end of a drag.
    const worldPointOf = useCallback(
        (event) => {
            if (!camera || lastPressDragged.current) return null;
            const box = event.currentTarget.getBoundingClientRect();
            return { x: camera.x + (event.clientX - box.left) / camera.zoom, y: camera.y + (event.clientY - box.top) / camera.zoom };
        },
        [camera],
    );

    const screenPointOf = useCallback(
        (point) => (camera ? { left: (point.x - camera.x) * camera.zoom, top: (point.y - camera.y) * camera.zoom } : null),
        [camera],
    );

    return {
        canvasRef,
        camera,
        setCamera: (next) => setCamera((current) => ({ ...current, ...next, zoom: clampZoom(next.zoom ?? current?.zoom ?? 1) })),
        fit,
        fitTo,
        focusElement,
        zoomIn: () => zoomAround(ZOOM_STEP),
        zoomOut: () => zoomAround(1 / ZOOM_STEP),
        setZoom: (zoom) => zoomAround(clampZoom(zoom) / (camera?.zoom ?? 1)),
        handlers,
        worldPointOf,
        screenPointOf,
    };
}
