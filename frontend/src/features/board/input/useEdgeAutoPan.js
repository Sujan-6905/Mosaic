import { useEffect, useRef } from "react";
import { panByScreenDelta } from "../camera/camera";

const EDGE_PX = 32;
const MAX_STEP_PX = 18;

// While something is being dragged, holding the pointer near the board's edge
// slides the board that way, so a selection or a box can reach past the screen.
export const useEdgeAutoPan = (board) => {
    const { containerRef, dragStateRef, handlePointerMove, isDrawingConnector, isDrawingShape, lastPointerClientRef, setCamera } = board;
    const moveRef = useRef(handlePointerMove);
    moveRef.current = handlePointerMove;

    useEffect(() => {
        let frame = null;
        let held = null;
        const step = () => {
            frame = null;
            const pointer = lastPointerClientRef.current;
            const container = containerRef.current;
            const dragging =
                ["move", "marquee", "lasso", "resize"].includes(dragStateRef.current?.mode) || isDrawingShape.current || isDrawingConnector.current;
            if (!held || !pointer || !container || !dragging) return;
            const rect = container.getBoundingClientRect();
            const push = (distanceToEdge) => (distanceToEdge < EDGE_PX ? ((EDGE_PX - Math.max(0, distanceToEdge)) / EDGE_PX) * MAX_STEP_PX : 0);
            const dx = push(pointer.x - rect.left) - push(rect.right - pointer.x);
            const dy = push(pointer.y - rect.top) - push(rect.bottom - pointer.y);
            if (dx || dy) {
                setCamera((camera) => panByScreenDelta(camera, dx, dy));
                moveRef.current({ ...held, clientX: pointer.x, clientY: pointer.y, preventDefault() {} });
            }
            frame = requestAnimationFrame(step);
        };
        const onDown = (e) => {
            if (e.pointerType === "touch") return;
            held = {
                pointerId: e.pointerId,
                pointerType: e.pointerType,
                buttons: e.buttons,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                target: e.target,
            };
            if (frame === null) frame = requestAnimationFrame(step);
        };
        const onUp = () => {
            held = null;
        };
        const container = containerRef.current;
        container?.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
        return () => {
            container?.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [containerRef, dragStateRef, isDrawingConnector, isDrawingShape, lastPointerClientRef, setCamera]);
};
