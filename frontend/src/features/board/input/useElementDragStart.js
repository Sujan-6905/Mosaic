import { defaultCamera } from "../camera/camera";
import { getElementBounds, getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { getPaintUnionBounds } from "../rendering/boundsCache";
import { boundConnectorScope } from "../../../../../shared/canvas/elements/connectors";
import { useCallback, useLayoutEffect } from "react";
import { DEFAULT_VIEW_HEIGHT, DEFAULT_VIEW_WIDTH } from "../state/boardHelpers";

export const useElementDragStart = (board) => {
    const {
        canvasRef,
        containerRef,
        contextRef,
        dragStateRef,
        elements,
        getCanvasCoordinates,
        hasEditAccess,
        hiddenStaticElementIdsRef,
        overlayCanvasRef,
        overlayContextRef,
        overlayModeRef,
        overlayShapeRef,
        requestStaticFullRepaint,
        selectedElementIds,
        setCamera,
        setViewportSize,
        staticNeedsFullRepaintRef,
    } = board;

    // Both canvases match the container in device pixels and follow it as it resizes.
    useLayoutEffect(() => {
        if (!canvasRef.current || !containerRef.current || !overlayCanvasRef.current) return;
        const canvas = canvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        const container = containerRef.current;
        contextRef.current = canvas.getContext("2d");
        overlayContextRef.current = overlayCanvas.getContext("2d");

        const resizeCanvases = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const width = Math.max(1, Math.round(rect.width));
            const height = Math.max(1, Math.round(rect.height));
            for (const c of [canvas, overlayCanvas]) {
                c.width = Math.round(width * dpr);
                c.height = Math.round(height * dpr);
                c.style.width = `${width}px`;
                c.style.height = `${height}px`;
            }
            setViewportSize({ width, height });
            staticNeedsFullRepaintRef.current = true;
        };

        resizeCanvases();
        const observer = new ResizeObserver(resizeCanvases);
        observer.observe(container);

        // No fill: the transparent bitmap lets the themed CSS background show through.
        const containerRect = container.getBoundingClientRect();
        setCamera(defaultCamera(containerRect.width, containerRect.height, DEFAULT_VIEW_WIDTH, DEFAULT_VIEW_HEIGHT));

        return () => observer.disconnect();
    }, [setCamera, canvasRef, containerRef, contextRef, overlayCanvasRef, overlayContextRef, setViewportSize, staticNeedsFullRepaintRef]);

    // Hides the element from the board layer once, rather than every tick, and lets the overlay draw it.
    const beginElementDrag = useCallback(
        (ids, originalElements, currentElements) => {
            // Arrows attached to what's moving follow it live on the overlay.
            const { connectorIds, scope } = boundConnectorScope(currentElements, ids);
            const drag = dragStateRef.current;
            if (drag) {
                drag.liveConnectorIds = connectorIds;
                drag.connectorScope = scope;
                connectorIds.forEach((id) => {
                    drag.originalElements[id] = currentElements[id];
                });
            }
            hiddenStaticElementIdsRef.current = new Set([...ids, ...connectorIds]);
            requestStaticFullRepaint(currentElements);
            overlayModeRef.current = "drag";
            overlayShapeRef.current = [...ids.map((id) => originalElements[id]), ...connectorIds.map((id) => currentElements[id])];
        },
        [requestStaticFullRepaint, hiddenStaticElementIdsRef, overlayModeRef, overlayShapeRef, dragStateRef],
    );

    // No browser text selection or native drag: a native drag ends in pointercancel with no pointerup,
    // leaving the board stuck mid-gesture with the element hidden.
    const handleResizeHandleStart = useCallback(
        (handleId, e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!hasEditAccess || selectedElementIds.length === 0) return;
            const originalElements = Object.fromEntries(selectedElementIds.map((id) => [id, elements[id]]));
            if (Object.values(originalElements).some((element) => !element || element.locked)) return;
            const bounds =
                selectedElementIds.length === 1 ? getElementBounds(elements[selectedElementIds[0]]) : getPaintUnionBounds(Object.values(originalElements));
            if (!bounds) return;
            dragStateRef.current = {
                mode: "resize",
                ids: selectedElementIds,
                handle: handleId,
                originalElements,
                originalBounds: bounds,
                hidden: true,
            };
            beginElementDrag(selectedElementIds, originalElements, elements);
        },
        [hasEditAccess, selectedElementIds, elements, beginElementDrag, dragStateRef],
    );

    // Pivot is the selection's centre, so one element spins in place and many
    // revolve together about their shared middle.
    const handleRotateHandleStart = useCallback(
        (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!hasEditAccess || selectedElementIds.length === 0) return;
            if (selectedElementIds.some((id) => elements[id]?.locked)) return;
            const originalElements = Object.fromEntries(selectedElementIds.map((id) => [id, elements[id]]));
            const bounds = getUnionBounds(Object.values(originalElements));
            if (!bounds) return;
            const pivotX = (bounds.minX + bounds.maxX) / 2;
            const pivotY = (bounds.minY + bounds.maxY) / 2;
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            dragStateRef.current = {
                mode: "rotate",
                ids: selectedElementIds,
                originalElements,
                pivotX,
                pivotY,
                startAngle: (Math.atan2(y - pivotY, x - pivotX) * 180) / Math.PI,
                hidden: true,
            };
            beginElementDrag(selectedElementIds, originalElements, elements);
        },
        [hasEditAccess, selectedElementIds, elements, beginElementDrag, getCanvasCoordinates, dragStateRef],
    );

    return {
        beginElementDrag,
        handleResizeHandleStart,
        handleRotateHandleStart,
    };
};
