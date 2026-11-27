import { COLORS, MENU_ITEMS } from "../tools/toolSettings";
import {
    resizeElementFromHandle,
    resizeSelectionFromHandle,
    rotateElementAroundPivot,
    translateElement,
} from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { getBoundConnectorUpdates } from "../../../../../shared/canvas/elements/connectors";
import { stickyHeightFor } from "../text/textFit";
import { colorTokenFor } from "../rendering/colorResolver";
import { computeSnapAdjustment, getSnapLines } from "../../../../../shared/canvas/geometry/alignment";
import { panByScreenDelta, zoomAtScreenPoint } from "../camera/camera";
import { createShakeDetector, SHAKEN_LOOSE_EVENT } from "./shakeLoose";

import { ROTATE_SNAP_THRESHOLD_DEG, SHIFT_ROTATE_STEP_DEG, SNAP_THRESHOLD_PX, isBoardChrome, nextFrameName, shapeBoxFromDrag } from "../state/boardHelpers";

const pick = (source, ids) => Object.fromEntries(ids.map((id) => [id, source[id]]));

// A note can't be sized smaller than its words at their smallest, and sizing it by
// hand makes that height the one it returns to.
const withHeightForItsText = (element) => {
    if (element.type !== "sticky") return element;
    return { ...element, height: stickyHeightFor(element, element.height), autoHeightBase: null };
};

// A connector dragged away from something that stays behind lets go of it.
const releaseStayingBindings = (element, movingIds) => {
    if (element.type !== "connector") return element;
    const releaseStart = element.startElementId && !movingIds.includes(element.startElementId);
    const releaseEnd = element.endElementId && !movingIds.includes(element.endElementId);
    if (!releaseStart && !releaseEnd) return element;
    return {
        ...element,
        ...(releaseStart ? { startElementId: null, startAnchor: null } : {}),
        ...(releaseEnd ? { endElementId: null, endAnchor: null } : {}),
    };
};

export const usePointerMove = (board) => {
    const {
        drawStyle,
        lastPointerClientRef,
        lastPointerWorldRef,
        moveConnector,
        movePlacement,
        noteRightDrag,
        placementRef,
        updateHoverFeedback,
        activeMenuItem,
        activeTouchPointersRef,
        beginElementDrag,
        cameraRef,
        color,
        connectorStart,
        containerRef,
        currentElementId,
        currentPath,
        dragStateRef,
        elements,
        emitCursorMoveRef,
        emitLaserPointRef,
        eraserPendingIdsRef,
        eraserTrailRef,
        fillColor,
        getCanvasCoordinates,
        getElementAtPoint,
        hiddenStaticElementIdsRef,
        initialShapePoint,
        isDrawingConnector,
        isDrawingFrame,
        isDrawingShape,
        isErasing,
        isLaserPointing,
        isPanning,
        lastPanPoint,
        localLaserTrailRef,
        opacity,
        overlayShapeRef,
        pinchGestureRef,
        queueElementUpdates,
        requestStaticFullRepaint,
        roomJoined,
        setCamera,
        setElements,
        setEraserPosition,
        shareId,
        shouldDraw,
        size,
        snapGuidesRef,
    } = board;

    const handlePointerMove = (e) => {
        if (e.pointerType === "touch" && activeTouchPointersRef.current.has(e.pointerId)) {
            activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pinchGestureRef.current) {
                e.preventDefault();
                // The two fingers that opened the gesture; a rejected palm is tracked but never one of them.
                const points = [...activeTouchPointersRef.current.values()].slice(0, 2);
                const rect = containerRef.current.getBoundingClientRect();
                const midpoint = {
                    x: (points[0].x + points[1].x) / 2 - rect.left,
                    y: (points[0].y + points[1].y) / 2 - rect.top,
                };
                const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
                const { initialDistance, initialMidpoint, cameraAtStart } = pinchGestureRef.current;
                const scale = distance / initialDistance;

                setCamera(() => {
                    const zoomed = zoomAtScreenPoint(cameraAtStart, initialMidpoint.x, initialMidpoint.y, cameraAtStart.zoom * scale);
                    return panByScreenDelta(zoomed, midpoint.x - initialMidpoint.x, midpoint.y - initialMidpoint.y);
                });
                return;
            }
            // One finger and no gesture: it behaves exactly like a mouse below.
        }

        const cursorPoint = getCanvasCoordinates(e.clientX, e.clientY);
        lastPointerClientRef.current = { x: e.clientX, y: e.clientY };
        lastPointerWorldRef.current = isBoardChrome(e.target) ? lastPointerWorldRef.current : cursorPoint;
        if (roomJoined && shareId) emitCursorMoveRef.current(shareId, cursorPoint.x, cursorPoint.y);
        noteRightDrag(e);

        if (placementRef.current) {
            movePlacement(cursorPoint.x, cursorPoint.y, e);
            return;
        }

        if (isPanning.current) {
            const deltaX = e.clientX - lastPanPoint.current.x;
            const deltaY = e.clientY - lastPanPoint.current.y;
            setCamera((prev) => panByScreenDelta(prev, deltaX, deltaY));
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isErasing.current) {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            setEraserPosition({ x: e.clientX, y: e.clientY });
            eraserTrailRef.current.push({ x, y, t: performance.now() });
            // Sample points along the path since consecutive events can be
            // far apart on a fast drag, otherwise skipping over an element.
            const lastX = lastPanPoint.current.x;
            const lastY = lastPanPoint.current.y;

            const dx = x - lastX;
            const dy = y - lastY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Math.max guards a size of 0 producing Infinity steps and
            // hanging the tab in the loop below.
            const steps = Math.max(1, Math.ceil(distance / (size / 2 || 1)));

            // Crossed elements are only marked; they are removed when the pointer lifts.
            let pendingChanged = false;
            for (let i = 0; i <= steps; i++) {
                const stepX = lastX + (dx / steps) * i;
                const stepY = lastY + (dy / steps) * i;
                const elementId = getElementAtPoint(stepX, stepY);
                if (elementId && !eraserPendingIdsRef.current.has(elementId)) {
                    eraserPendingIdsRef.current.add(elementId);
                    pendingChanged = true;
                }
            }
            if (pendingChanged) {
                hiddenStaticElementIdsRef.current = new Set(eraserPendingIdsRef.current);
                requestStaticFullRepaint(elements);
            }
            lastPanPoint.current = { x, y };
            return;
        }

        if (dragStateRef.current?.mode === "marquee") {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            const drag = dragStateRef.current;
            overlayShapeRef.current = { startX: drag.startX, startY: drag.startY, endX: x, endY: y };
            return;
        }

        if (dragStateRef.current?.mode === "lasso") {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            dragStateRef.current.points.push({ x, y });
            overlayShapeRef.current = dragStateRef.current.points;
            return;
        }

        if (dragStateRef.current) {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            const drag = dragStateRef.current;
            // Resize hid its element when the handle was pressed, so this first hides a move or rotate.
            if (!drag.hidden) {
                drag.hidden = true;
                beginElementDrag(drag.ids, drag.originalElements, elements);
            }

            const updatedById = {};
            if (drag.mode === "move") {
                drag.shake ??= createShakeDetector();
                if (drag.shake(e.clientX, e.timeStamp)) {
                    drag.shaken = true;
                    window.dispatchEvent(new CustomEvent(SHAKEN_LOOSE_EVENT, { detail: { clientX: e.clientX, clientY: e.clientY } }));
                }
                const lockToX = e.shiftKey && Math.abs(x - drag.startX) >= Math.abs(y - drag.startY);
                const lockToY = e.shiftKey && !lockToX;
                const dx = lockToY ? 0 : x - drag.startX;
                const dy = lockToX ? 0 : y - drag.startY;
                const translated = {};
                drag.ids.forEach((id) => {
                    translated[id] = translateElement(drag.originalElements[id], dx, dy);
                });

                // Snaps the selection's bounds to other elements' edges and centres, at a constant on-screen distance.
                const draggedBounds = getUnionBounds(Object.values(translated));
                // Only the dragged elements move, so the lines hold for the whole drag.
                drag.snapLines ??= getSnapLines(
                    Object.entries(elements)
                        .filter(([id]) => !drag.ids.includes(id))
                        .map(([, element]) => element),
                );
                const snapLines = drag.snapLines;
                const thresholdWorld = SNAP_THRESHOLD_PX / cameraRef.current.zoom;
                const snap = draggedBounds ? computeSnapAdjustment(draggedBounds, snapLines, thresholdWorld) : { dx: 0, dy: 0, snappedX: null, snappedY: null };
                if (lockToX) Object.assign(snap, { dy: 0, snappedY: null });
                if (lockToY) Object.assign(snap, { dx: 0, snappedX: null });
                snapGuidesRef.current = { x: snap.snappedX, y: snap.snappedY };

                drag.ids.forEach((id) => {
                    const moved = snap.dx || snap.dy ? translateElement(translated[id], snap.dx, snap.dy) : translated[id];
                    updatedById[id] = releaseStayingBindings(moved, drag.ids);
                });
            } else if (drag.mode === "rotate") {
                const currentAngle = (Math.atan2(y - drag.pivotY, x - drag.pivotX) * 180) / Math.PI;
                let deltaDegrees = currentAngle - drag.startAngle;
                // Snapped from the first element's angle, then applied to all, so a multi-selection turns together.
                const primaryOriginalRotation = drag.originalElements[drag.ids[0]]?.rotation || 0;
                const rawFinalRotation = primaryOriginalRotation + deltaDegrees;
                if (e.shiftKey) {
                    deltaDegrees += Math.round(rawFinalRotation / SHIFT_ROTATE_STEP_DEG) * SHIFT_ROTATE_STEP_DEG - rawFinalRotation;
                } else {
                    const nearestRightAngle = Math.round(rawFinalRotation / 90) * 90;
                    if (Math.abs(rawFinalRotation - nearestRightAngle) <= ROTATE_SNAP_THRESHOLD_DEG) {
                        deltaDegrees += nearestRightAngle - rawFinalRotation;
                    }
                }
                drag.ids.forEach((id) => {
                    updatedById[id] = rotateElementAroundPivot(drag.originalElements[id], drag.pivotX, drag.pivotY, deltaDegrees);
                });
            } else if (drag.mode === "connectorEdit") {
                updatedById[drag.ids[0]] = drag.edit(x, y);
            } else if (drag.ids.length === 1) {
                const elementId = drag.ids[0];
                const original = drag.originalElements[elementId];
                // A photo keeps its proportions unless Shift says otherwise; everything else the reverse.
                const keepAspect = original.type === "image" ? !e.shiftKey : e.shiftKey;
                updatedById[elementId] = withHeightForItsText(resizeElementFromHandle(original, drag.handle, { x, y }, { keepAspect, fromCenter: e.altKey }));
            } else {
                Object.assign(
                    updatedById,
                    resizeSelectionFromHandle(pick(drag.originalElements, drag.ids), drag.originalBounds, drag.handle, { x, y }, { fromCenter: e.altKey }),
                );
            }

            drag.latestUpdatedById = updatedById;

            // Kept on the drag for the release, which keeps this handler from depending on elements.
            // The overlay draws the live position; elements still updates so the selection handles follow.
            drag.latestElements = { ...drag.latestElements, ...updatedById };
            drag.liveConnectors = drag.liveConnectorIds?.length ? getBoundConnectorUpdates({ ...drag.connectorScope, ...drag.latestElements }, drag.ids) : {};
            overlayShapeRef.current = [...drag.ids.map((id) => drag.latestElements[id]), ...Object.values(drag.liveConnectors)];
            setElements((prev) => ({ ...prev, ...updatedById, ...drag.liveConnectors }));
            if (roomJoined && shareId) {
                queueElementUpdates(updatedById);
            }
            return;
        }

        if (isDrawingShape.current && initialShapePoint.current) {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            overlayShapeRef.current = {
                type: "shape",
                shapeType: activeMenuItem,
                ...shapeBoxFromDrag(activeMenuItem, initialShapePoint.current, x, y, { square: e.shiftKey, fromCenter: e.altKey }),
                color: color,
                colorToken: colorTokenFor(color) ?? null,
                fillColor: fillColor,
                fillColorToken: colorTokenFor(fillColor) ?? null,
                fillStyle: drawStyle.fillStyle,
                strokeStyle: drawStyle.strokeStyle,
                cornerRadius: drawStyle.cornerRadius,
                roughness: drawStyle.roughness,
                size: size,
                opacity: opacity,
            };
            return;
        }

        if (isDrawingFrame.current && initialShapePoint.current) {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            overlayShapeRef.current = {
                type: "frame",
                startX: initialShapePoint.current.x,
                startY: initialShapePoint.current.y,
                endX: x,
                endY: y,
                name: nextFrameName(elements),
                color: COLORS.GRAY,
            };
            return;
        }

        if (isDrawingConnector.current && connectorStart.current) {
            moveConnector(cursorPoint.x, cursorPoint.y);
            return;
        }

        if (isLaserPointing.current) {
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            localLaserTrailRef.current = [...localLaserTrailRef.current, { x, y, t: Date.now() }];
            if (roomJoined && shareId) emitLaserPointRef.current(shareId, x, y);
            return;
        }

        updateHoverFeedback(cursorPoint, e);

        if (!shouldDraw.current || ![MENU_ITEMS.PENCIL, MENU_ITEMS.PEN, MENU_ITEMS.HIGHLIGHTER].includes(activeMenuItem)) {
            return;
        }

        const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
        if (currentElementId.current) {
            // The overlay reads this buffer every frame and recomputes the tapered outline, which depends on earlier points too.
            currentPath.current.push({ x, y, rawPressure: e.pressure });
        }
    };

    return {
        handlePointerMove,
    };
};
