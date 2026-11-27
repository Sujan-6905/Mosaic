import { COLORS, MENU_ITEMS } from "../tools/toolSettings";
import { applyFrameMembership } from "../../../../../shared/canvas/elements/frames";
import { classifyStroke } from "../../../../../shared/canvas/strokes/shapeRecognizer";
import { colorTokenFor } from "../rendering/colorResolver";
import { getBoundConnectorUpdates, releaseConnectorsFrom } from "../../../../../shared/canvas/elements/connectors";
import { getElementsInLasso } from "../selection/lassoSelect";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { resolveStrokePressures } from "../rendering/strokeRenderer";
import { compactStrokePoints } from "../../../../../shared/canvas/strokes/strokePoints.js";
import { menuItemClick } from "@/store/menuSlice";
import { defaultShapeBox, nextFrameName, shapeBoxFromDrag, withSchemaV2Fields } from "../state/boardHelpers";

const CLICK_DRAG_PX = 4;

export const usePointerUp = (board) => {
    const {
        bindTargetRef,
        cameraRef,
        dispatch,
        drawStyle,
        lastDuplicateRef,
        finishConnector,
        finishPlacement,
        finishToolUse,
        placementRef,
        activeMenuItem,
        activeTouchPointersRef,
        addElement,
        cancelPendingElementUpdates,
        clearOverlayCanvas,
        clearRedoStack,
        color,
        connectorStart,
        currentElementId,
        currentPath,
        currentStrokeUsesRealPressureRef,
        dragStateRef,
        elements,
        emitCanvasUpdate,
        enqueueStaticInsert,
        eraserPendingIdsRef,
        eraserTrailRef,
        fillColor,
        getCanvasCoordinates,
        handlePointerUpRef,
        hiddenStaticElementIdsRef,
        initialShapePoint,
        isDrawing,
        isDrawingConnector,
        isDrawingFrame,
        isDrawingShape,
        isErasing,
        isLaserPointing,
        isPanning,
        ctrlClickTargetRef,
        lastPanPoint,
        opacity,
        overlayModeRef,
        overlayShapeRef,
        pinchGestureRef,
        pushUndoEntry,
        removeElement,
        replaceWithRecognizedShape,
        requestStaticFullRepaint,
        roomJoined,
        setElements,
        setEraserPosition,
        setSelectedElementIds,
        shapeAssistEnabled,
        shareId,
        shouldDraw,
        showToast,
        size,
        snapGuidesRef,
        spatialIndexRef,
        style,
        suppressTouchDrawRef,
    } = board;

    const handlePointerUp = (e) => {
        if (e.pointerType === "touch") {
            activeTouchPointersRef.current.delete(e.pointerId);
            if (pinchGestureRef.current) {
                pinchGestureRef.current = null;
                // A finger still down when a pinch ends must not start a stroke.
                suppressTouchDrawRef.current = activeTouchPointersRef.current.size > 0;
            }
            if (activeTouchPointersRef.current.size === 0) {
                suppressTouchDrawRef.current = false;
            }
        }

        if (isPanning.current) {
            isPanning.current = false;
            const ctrlClick = ctrlClickTargetRef.current;
            ctrlClickTargetRef.current = null;
            if (ctrlClick && Math.hypot(e.clientX - ctrlClick.clientX, e.clientY - ctrlClick.clientY) < CLICK_DRAG_PX) {
                setSelectedElementIds((selected) =>
                    selected.includes(ctrlClick.elementId) ? selected.filter((id) => id !== ctrlClick.elementId) : [...selected, ctrlClick.elementId],
                );
            }
            return;
        }
        if (placementRef.current) {
            const point = getCanvasCoordinates(e.clientX, e.clientY);
            finishPlacement(point.x, point.y, e);
            return;
        }
        if (isErasing.current) {
            isErasing.current = false;
            setEraserPosition(null);
            lastPanPoint.current = { x: 0, y: 0 };
            const idsToRemove = eraserPendingIdsRef.current;
            eraserPendingIdsRef.current = new Set();
            eraserTrailRef.current = [];
            hiddenStaticElementIdsRef.current = new Set();
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            idsToRemove.forEach((elementId) => removeElement(elementId));
            return;
        }
        if (dragStateRef.current?.mode === "marquee") {
            const drag = dragStateRef.current;
            dragStateRef.current = null;
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            // Anything the marquee touches is selected; locked elements only by an explicit click.
            const hitIds = spatialIndexRef.current
                .queryRect({
                    minX: Math.min(drag.startX, x),
                    minY: Math.min(drag.startY, y),
                    maxX: Math.max(drag.startX, x),
                    maxY: Math.max(drag.startY, y),
                })
                .filter((id) => !elements[id]?.locked);
            setSelectedElementIds([...new Set([...drag.baseSelection, ...hitIds])]);
            return;
        }

        if (dragStateRef.current?.mode === "lasso") {
            const drag = dragStateRef.current;
            dragStateRef.current = null;
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            // The lasso's bounding box narrows the candidates, then each is tested against the polygon itself.
            const xs = drag.points.map((p) => p.x);
            const ys = drag.points.map((p) => p.y);
            const candidateIds = spatialIndexRef.current.queryRect({
                minX: Math.min(...xs),
                minY: Math.min(...ys),
                maxX: Math.max(...xs),
                maxY: Math.max(...ys),
            });
            const hitIds = getElementsInLasso(elements, candidateIds, drag.points).filter((id) => !elements[id]?.locked);
            if (drag.fromTool) dispatch(menuItemClick(MENU_ITEMS.SELECT));
            setSelectedElementIds([...new Set([...drag.baseSelection, ...hitIds])]);
            return;
        }

        if (dragStateRef.current) {
            const drag = dragStateRef.current;
            dragStateRef.current = null;
            snapGuidesRef.current = { x: null, y: null };
            bindTargetRef.current = null;
            if (drag.deselectOnClick && !drag.hidden) {
                setSelectedElementIds((selected) => selected.filter((id) => !drag.deselectOnClick.includes(id)));
            }
            // With no move between press and release, latestElements was never filled and nothing moved.
            const rawFinalElements = (drag.hidden && drag.latestElements) || drag.originalElements;
            // A plain click to select records no undo step and sends nothing.
            const rawChangedIds = drag.ids.filter((id) => rawFinalElements[id] !== drag.originalElements[id]);
            if (drag.copied && rawChangedIds.length > 0) {
                const from = getUnionBounds(drag.ids.map((id) => drag.originalElements[id]));
                const to = getUnionBounds(drag.ids.map((id) => rawFinalElements[id]));
                if (from && to) lastDuplicateRef.current = { ids: drag.ids, offset: { dx: to.minX - from.minX, dy: to.minY - from.minY } };
            }

            // Frame membership and bound connectors follow the final positions, worked out once on release.
            const postDragElements = { ...elements, ...rawFinalElements };
            const membershipRaw =
                rawChangedIds.length > 0
                    ? applyFrameMembership(postDragElements, Object.fromEntries(rawChangedIds.map((id) => [id, rawFinalElements[id]])))
                    : {};
            // Only ids whose frame changed count, or every ordinary move would force a full repaint.
            const membershipUpdates = Object.fromEntries(Object.entries(membershipRaw).filter(([id, el]) => el !== rawFinalElements[id]));
            // A shaken shape drops its arrows where they are instead of taking them along.
            const shakenLoose = drag.shaken ? releaseConnectorsFrom(postDragElements, drag.ids) : {};
            const connectorUpdates = getBoundConnectorUpdates({ ...postDragElements, ...membershipUpdates, ...shakenLoose }, rawChangedIds);
            const extraUpdates = { ...membershipUpdates, ...shakenLoose, ...connectorUpdates };
            const finalElements = { ...rawFinalElements, ...extraUpdates };
            const changedIds = [...new Set([...rawChangedIds, ...Object.keys(extraUpdates)])];

            // Only a real drag hid elements from the board layer, so only it has anything to restore.
            if (drag.hidden) {
                hiddenStaticElementIdsRef.current = new Set();
                overlayModeRef.current = null;
                overlayShapeRef.current = null;
                clearOverlayCanvas();
                if (Object.keys(extraUpdates).length > 0) {
                    // Changes outside the dragged ids still have stale pixels on the board layer, which only a full repaint clears.
                    setElements((prev) => {
                        const next = { ...prev, ...extraUpdates };
                        requestStaticFullRepaint(next);
                        return next;
                    });
                    Object.keys(extraUpdates).forEach((id) => spatialIndexRef.current.update(id, extraUpdates[id]));
                } else {
                    drag.ids.forEach((id) => enqueueStaticInsert(id, finalElements[id]));
                }
            }
            if (changedIds.length > 0) {
                // Drops throttled mid-drag updates, so a late one can't land after the final position.
                cancelPendingElementUpdates(rawChangedIds);
                const ops = changedIds.map((id) => ({
                    type: "update",
                    elementId: id,
                    before: drag.originalElements[id] ?? elements[id],
                    after: finalElements[id],
                }));
                pushUndoEntry(ops.length === 1 ? ops[0] : { type: "batch", ops });
                clearRedoStack();
                if (roomJoined && shareId) {
                    changedIds.forEach((id) => {
                        emitCanvasUpdate({ shareId, operation: "update", elementId: id, element: finalElements[id] });
                    });
                }
            }
            return;
        }
        if (isDrawingShape.current && initialShapePoint.current) {
            isDrawingShape.current = false;
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();

            const box = shapeBoxFromDrag(activeMenuItem, initialShapePoint.current, x, y, { square: e.shiftKey, fromCenter: e.altKey });
            const clicked =
                Math.abs(box.endX - box.startX) * cameraRef.current.zoom < CLICK_DRAG_PX &&
                Math.abs(box.endY - box.startY) * cameraRef.current.zoom < CLICK_DRAG_PX;
            const finalElement = withSchemaV2Fields(
                {
                    type: "shape",
                    shapeType: activeMenuItem,
                    ...(clicked ? defaultShapeBox(activeMenuItem, initialShapePoint.current) : box),
                    color: color,
                    fillColor: fillColor,
                    fillColorToken: colorTokenFor(fillColor) ?? null,
                    fillStyle: drawStyle.fillStyle,
                    strokeStyle: drawStyle.strokeStyle,
                    cornerRadius: drawStyle.cornerRadius,
                    roughness: drawStyle.roughness,
                    size: size,
                    opacity: opacity,
                },
                elements,
            );
            addElement(currentElementId.current, finalElement);
            finishToolUse([currentElementId.current]);
            initialShapePoint.current = null;
            currentElementId.current = null;
            return;
        }

        if (isDrawingFrame.current && initialShapePoint.current) {
            isDrawingFrame.current = false;
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();

            const finalElement = withSchemaV2Fields(
                {
                    type: "frame",
                    startX: initialShapePoint.current.x,
                    startY: initialShapePoint.current.y,
                    endX: x,
                    endY: y,
                    name: nextFrameName(elements),
                    color: COLORS.GRAY,
                },
                elements,
            );
            // A new frame goes to the bottom, or it would cover what it was drawn around.
            finalElement.zIndex = 0;
            addElement(currentElementId.current, finalElement);
            finishToolUse([currentElementId.current]);
            initialShapePoint.current = null;
            currentElementId.current = null;
            return;
        }

        if (isDrawingConnector.current && connectorStart.current) {
            const point = getCanvasCoordinates(e.clientX, e.clientY);
            finishConnector(point.x, point.y);
            return;
        }

        if (isLaserPointing.current) {
            isLaserPointing.current = false;
            return;
        }

        if (!shouldDraw.current || ![MENU_ITEMS.PENCIL, MENU_ITEMS.PEN, MENU_ITEMS.HIGHLIGHTER].includes(activeMenuItem)) {
            return;
        }
        shouldDraw.current = false;
        isDrawing.current = false;
        overlayModeRef.current = null;
        clearOverlayCanvas();
        if (currentElementId.current && currentPath.current.length > 1) {
            const resolvedPoints = compactStrokePoints(
                resolveStrokePressures(currentPath.current, currentStrokeUsesRealPressureRef.current),
                cameraRef.current.zoom,
            );
            const strokeElement = withSchemaV2Fields(
                {
                    type: "path",
                    points: resolvedPoints,
                    color: color,
                    size: size,
                    opacity: opacity,
                    style: style,
                    pressure: drawStyle.pressure,
                    steadying: drawStyle.steadying,
                    timestamp: Date.now(),
                },
                elements,
            );
            const recognized = shapeAssistEnabled ? classifyStroke(resolvedPoints) : null;
            if (recognized) {
                const shapeElement = withSchemaV2Fields(
                    {
                        type: "shape",
                        shapeType: recognized.shapeType,
                        startX: recognized.bounds.startX,
                        startY: recognized.bounds.startY,
                        endX: recognized.bounds.endX,
                        endY: recognized.bounds.endY,
                        color: color,
                        fillColor: fillColor,
                        fillColorToken: colorTokenFor(fillColor) ?? null,
                        size: size,
                        opacity: opacity,
                    },
                    elements,
                );
                replaceWithRecognizedShape(currentElementId.current, strokeElement, shapeElement);
                showToast?.success(
                    "Shape Recognized",
                    `Cleaned up your sketch into a ${recognized.shapeType.toLowerCase()} - Ctrl+Z to keep the original stroke`,
                );
            } else {
                addElement(currentElementId.current, strokeElement);
            }
        }
        currentElementId.current = null;
        currentPath.current = [];
    };
    handlePointerUpRef.current = handlePointerUp;

    return {
        handlePointerUp,
    };
};
