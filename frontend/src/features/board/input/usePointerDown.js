import { CONNECTOR_TOOLS, MENU_ITEMS, SHAPE_TOOLS } from "../tools/toolSettings";
import { buildDuplicatedElements } from "../../../../../shared/canvas/editing/duplication.js";
import { expandWithFrameChildren } from "../../../../../shared/canvas/elements/frames";
import { worldPointToElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { menuItemClick } from "@/store/menuSlice";
import { isSafeLink } from "../../../../../shared/canvas/elements/links.js";
import { linkInTextAt } from "../text/textLinks";
import { cellAt } from "../text/tableLayout";
import { generateElementId, isBoardChrome } from "../state/boardHelpers";
import { resolveConnectorPolyline } from "../../../../../shared/canvas/elements/connectors";
import { isOnConnectorLabel } from "./useHitTesting";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

const DOUBLE_PRESS_MS = 500;

export const usePointerDown = (board) => {
    const {
        addGeneratedElements,
        beginConnector,
        beginLabelDrag,
        color,
        contextRef,
        drawStyle,
        editingElementId,
        editTableCell,
        openTextEditor,
        canVote,
        castVote,
        placeStamp,
        enteredGroupIdRef,
        lastSelectPressAtRef,
        opacity,
        beginPlacement,
        handleBucketClick,
        noteRightPress,
        selectionBeforePressRef,
        spaceHeldRef,
        activeMenuItem,
        activeTouchPointersRef,
        cameraRef,
        canComment,
        canvasRef,
        clearOverlayCanvas,
        containerRef,
        currentElementId,
        currentPath,
        currentStrokeStyleRef,
        currentStrokeUsesRealPressureRef,
        dispatch,
        dragStateRef,
        elements,
        emitLaserPointRef,
        eraserPendingIdsRef,
        eraserTrailRef,
        getCanvasCoordinates,
        getElementAtPoint,
        getSelectionTolerance,
        handlePointerUpRef,
        hasEditAccess,
        hiddenStaticElementIdsRef,
        initialShapePoint,
        isDrawing,
        isDrawingFrame,
        isDrawingShape,
        isErasing,
        isLaserPointing,
        isPanning,
        ctrlClickTargetRef,
        lastPanPoint,
        localLaserTrailRef,
        overlayModeRef,
        overlayShapeRef,
        pinchGestureRef,
        requestStaticFullRepaint,
        roomJoined,
        selectedElementIds,
        setEraserPosition,
        setPendingCommentAnchor,
        setSelectedElementIds,
        shareId,
        shouldDraw,
        size,
        startLaserAging,
        style,
        suppressTouchDrawRef,
    } = board;

    const handlePointerDown = (e) => {
        if (!canvasRef.current || isBoardChrome(e.target)) return;

        if (e.pointerType === "touch") {
            activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const touchCount = activeTouchPointersRef.current.size;

            if (touchCount === 2) {
                e.preventDefault();
                // A second finger means the first never started anything; pointer-up finishes or aborts it as on release.
                const [first] = activeTouchPointersRef.current.values();
                handlePointerUpRef.current?.({ clientX: first.x, clientY: first.y });

                const points = [...activeTouchPointersRef.current.values()];
                const rect = containerRef.current.getBoundingClientRect();
                pinchGestureRef.current = {
                    initialDistance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
                    initialMidpoint: {
                        x: (points[0].x + points[1].x) / 2 - rect.left,
                        y: (points[0].y + points[1].y) / 2 - rect.top,
                    },
                    cameraAtStart: cameraRef.current,
                };
                return;
            }

            if (touchCount > 2) {
                // A resting palm or third finger is tracked, so the pointer count stays right, but starts nothing.
                e.preventDefault();
                return;
            }

            if (suppressTouchDrawRef.current) {
                // The tail end of a pinch: this finger was one of the
                // two, hasn't lifted yet, and must not restart as a draw.
                e.preventDefault();
                return;
            }
        }

        // Handles and comment pins sit inside the board, so their presses reach this native listener too.
        // Without these, a press on a handle would read as a miss and clear the selection being resized.
        if (e.target?.closest?.("[data-selection-handle]")) return;
        if (e.target?.closest?.("[data-comment-pin]")) return;
        const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
        if (overlayModeRef.current === "hover") {
            overlayModeRef.current = null;
            clearOverlayCanvas();
        }

        ctrlClickTargetRef.current = null;
        if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
            const linkedId = getElementAtPoint(x, y, getSelectionTolerance);
            const link = linkedId && (linkInTextAt(elements[linkedId], { x, y }) ?? (isSafeLink(elements[linkedId].link) ? elements[linkedId].link : null));
            if (link) {
                e.preventDefault();
                window.open(link, "_blank", "noopener,noreferrer");
                return;
            }
            if (linkedId && activeMenuItem === MENU_ITEMS.SELECT) ctrlClickTargetRef.current = { elementId: linkedId, clientX: e.clientX, clientY: e.clientY };
        }

        if (e.button === 2) noteRightPress(e);

        if (e.button === 1 || (e.button === 0 && e.ctrlKey) || e.button === 2 || spaceHeldRef.current) {
            e.preventDefault();
            isPanning.current = true;
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (activeMenuItem === MENU_ITEMS.HAND) {
            isPanning.current = true;
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // While a dot vote is open, a click on an item votes for it instead of selecting it.
        if (canVote && activeMenuItem === MENU_ITEMS.SELECT && e.button === 0) {
            const votedId = getElementAtPoint(x, y, getSelectionTolerance);
            if (votedId) {
                e.preventDefault();
                castVote(votedId, true);
                return;
            }
        }

        // Above the edit-access check, because a commenter can't edit but can still comment.
        if (activeMenuItem === MENU_ITEMS.COMMENT) {
            if (!canComment) return;
            const hitId = getElementAtPoint(x, y, getSelectionTolerance);
            setPendingCommentAnchor({
                anchor: hitId ? { type: "element", elementId: hitId } : { type: "point", x, y },
                screenX: e.clientX,
                screenY: e.clientY,
            });
            dispatch(menuItemClick(MENU_ITEMS.SELECT));
            return;
        }

        // Viewers can still pan; the server would refuse an edit, so the board never shows one.
        if (!hasEditAccess) return;

        if (activeMenuItem === MENU_ITEMS.ERASER) {
            isErasing.current = true;
            setEraserPosition({ x: e.clientX, y: e.clientY });
            // Erasing reads this point in world space, so it is re-seeded for each stroke.
            lastPanPoint.current = { x, y };
            eraserPendingIdsRef.current = new Set();
            eraserTrailRef.current = [{ x, y, t: performance.now() }];
            overlayModeRef.current = "erase";
            const elementId = getElementAtPoint(x, y);
            if (elementId) {
                eraserPendingIdsRef.current.add(elementId);
                hiddenStaticElementIdsRef.current = new Set(eraserPendingIdsRef.current);
                requestStaticFullRepaint(elements);
            }
            return;
        }

        if (activeMenuItem === MENU_ITEMS.SELECT) {
            const hitId = getElementAtPoint(x, y, getSelectionTolerance);
            // A double-click reads what was selected before its first press,
            // since that press has already changed the selection.
            const pressedAt = performance.now();
            if (pressedAt - lastSelectPressAtRef.current > DOUBLE_PRESS_MS) selectionBeforePressRef.current = selectedElementIds;
            lastSelectPressAtRef.current = pressedAt;

            // A press inside the selection's box grabs the selection, even between the thin strokes of a line or path.
            const onlySelected = selectedElementIds.length === 1 ? elements[selectedElementIds[0]] : null;
            const selectionBounds =
                selectedElementIds.length > 0 && onlySelected?.type !== "connector"
                    ? getUnionBounds(selectedElementIds.map((id) => elements[id]).filter(Boolean))
                    : null;
            const localPoint = onlySelected ? worldPointToElement(onlySelected, { x, y }) : { x, y };
            const hitSelectionBox =
                !hitId &&
                !e.shiftKey &&
                !e.altKey &&
                !!selectionBounds &&
                localPoint.x >= selectionBounds.minX &&
                localPoint.x <= selectionBounds.maxX &&
                localPoint.y >= selectionBounds.minY &&
                localPoint.y <= selectionBounds.maxY;

            if (!hitId && !hitSelectionBox) {
                // A drag on empty board starts a marquee, or a lasso with Alt; Shift adds to the selection, otherwise it is replaced.
                enteredGroupIdRef.current = null;
                if (!e.shiftKey) setSelectedElementIds([]);
                if (e.altKey) {
                    dragStateRef.current = {
                        mode: "lasso",
                        points: [{ x, y }],
                        baseSelection: e.shiftKey ? selectedElementIds : [],
                    };
                    overlayModeRef.current = "lasso";
                    overlayShapeRef.current = [{ x, y }];
                } else {
                    dragStateRef.current = {
                        mode: "marquee",
                        startX: x,
                        startY: y,
                        baseSelection: e.shiftKey ? selectedElementIds : [],
                    };
                    overlayModeRef.current = "marquee";
                    overlayShapeRef.current = { startX: x, startY: y, endX: x, endY: y };
                }
                clearOverlayCanvas();
                return;
            }

            const hitElement = hitId ? elements[hitId] : null;
            // A click on another cell of the table being typed in moves the typing there.
            if (editingElementId && hitId === editingElementId && hitElement.type === "table") {
                const cell = cellAt(hitElement, { x, y });
                if (cell) {
                    e.preventDefault();
                    editTableCell(cell);
                    return;
                }
            }
            // A click on other words while typing moves the typing there.
            if (
                editingElementId &&
                hitId &&
                hitId !== editingElementId &&
                !hitElement.locked &&
                !e.shiftKey &&
                !e.altKey &&
                (hitElement.type === "text" || hitElement.type === "sticky" || (hitElement.type === "shape" && hitElement.text))
            ) {
                setSelectedElementIds([hitId]);
                openTextEditor(hitId);
                return;
            }
            // Clicking any member of a group selects the whole group, unless
            // a double-click has already opened that group.
            if (hitElement && hitElement.groupId !== enteredGroupIdRef.current) enteredGroupIdRef.current = null;
            const targetIds = hitSelectionBox
                ? selectedElementIds
                : hitElement?.groupId && hitElement.groupId !== enteredGroupIdRef.current
                  ? Object.entries(elements)
                        .filter(([, el]) => el.groupId === hitElement.groupId)
                        .map(([id]) => id)
                  : [hitId];

            if (
                hitElement?.type === "connector" &&
                !hitElement.locked &&
                !e.shiftKey &&
                !e.altKey &&
                isOnConnectorLabel(contextRef.current, hitElement, resolveConnectorPolyline(hitElement, elements), x, y)
            ) {
                setSelectedElementIds(targetIds);
                if (targetIds.length === 1) beginLabelDrag(hitId);
                return;
            }

            let nextSelection;
            // Shift on something already selected deselects it on release, and only
            // if the press stayed a click: a Shift-drag moves it along one axis instead.
            let deselectOnClick = null;
            if (hitSelectionBox) {
                nextSelection = selectedElementIds;
            } else if (e.shiftKey) {
                const alreadySelected = targetIds.every((id) => selectedElementIds.includes(id));
                nextSelection = alreadySelected ? selectedElementIds : [...new Set([...selectedElementIds, ...targetIds])];
                if (alreadySelected) deselectOnClick = targetIds;
            } else if (targetIds.every((id) => selectedElementIds.includes(id))) {
                // Pressing inside a multi-selection keeps it whole, so it drags as a group.
                nextSelection = selectedElementIds;
            } else {
                nextSelection = targetIds;
            }
            setSelectedElementIds(nextSelection);

            // A locked element stays selectable, so its lock can be found and undone, but doesn't move.
            if (targetIds.some((id) => elements[id]?.locked)) return;

            // Alt-dragging pulls a copy off and drags that instead.
            if (e.altKey && hitId) {
                const copies = buildDuplicatedElements(elements, nextSelection, { dx: 0, dy: 0 }, generateElementId, nextZIndex(elements));
                addGeneratedElements(copies);
                const copyIds = copies.map(({ elementId }) => elementId);
                setSelectedElementIds(copyIds);
                dragStateRef.current = {
                    mode: "move",
                    ids: copyIds,
                    originalElements: Object.fromEntries(copies.map(({ elementId, element }) => [elementId, element])),
                    startX: x,
                    startY: y,
                    hidden: false,
                    copied: true,
                };
                return;
            }

            // A dragged frame carries its children, though only the frame shows as selected.
            const dragIds = expandWithFrameChildren(elements, nextSelection);
            dragStateRef.current = {
                mode: "move",
                ids: dragIds,
                originalElements: Object.fromEntries(dragIds.map((id) => [id, elements[id]])),
                startX: x,
                startY: y,
                hidden: false,
                deselectOnClick,
            };
            // Elements are hidden from the board layer only once a real drag starts, so a plain click costs no repaint.
            return;
        }

        if (activeMenuItem === MENU_ITEMS.LASSO) {
            setSelectedElementIds([]);
            dragStateRef.current = { mode: "lasso", points: [{ x, y }], baseSelection: [], fromTool: true };
            overlayModeRef.current = "lasso";
            overlayShapeRef.current = [{ x, y }];
            clearOverlayCanvas();
            return;
        }

        if (activeMenuItem === MENU_ITEMS.BUCKET) {
            handleBucketClick(x, y);
            return;
        }

        if (CONNECTOR_TOOLS.includes(activeMenuItem)) {
            beginConnector(x, y);
            return;
        }

        if (SHAPE_TOOLS.includes(activeMenuItem)) {
            isDrawingShape.current = true;
            initialShapePoint.current = { x, y };
            currentElementId.current = generateElementId();
            overlayModeRef.current = "shape";
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            return;
        }

        if (activeMenuItem === MENU_ITEMS.PENCIL || activeMenuItem === MENU_ITEMS.PEN || activeMenuItem === MENU_ITEMS.HIGHLIGHTER) {
            // Only a stylus really reports pressure; a mouse or finger always
            // reports the spec default, so those strokes take it from speed.
            currentStrokeUsesRealPressureRef.current = e.pointerType === "pen";
            shouldDraw.current = true;
            isDrawing.current = true;
            currentElementId.current = generateElementId();
            currentPath.current = [{ x, y, rawPressure: e.pressure }];
            currentStrokeStyleRef.current = { color, size, opacity, style, pressure: drawStyle.pressure, steadying: drawStyle.steadying };
            overlayModeRef.current = "stroke";
            clearOverlayCanvas();
            // Capture keeps moves arriving when a fast stroke leaves the board for a moment.
            e.target?.setPointerCapture?.(e.pointerId);
            return;
        }

        if (activeMenuItem === MENU_ITEMS.STAMP) {
            e.preventDefault();
            placeStamp(x, y);
            return;
        }

        if (activeMenuItem === MENU_ITEMS.TEXT || activeMenuItem === MENU_ITEMS.STICKY || activeMenuItem === MENU_ITEMS.TABLE) {
            e.preventDefault();
            beginPlacement(activeMenuItem, x, y);
            return;
        }

        if (activeMenuItem === MENU_ITEMS.FRAME) {
            isDrawingFrame.current = true;
            initialShapePoint.current = { x, y };
            currentElementId.current = generateElementId();
            overlayModeRef.current = "shape";
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            return;
        }

        if (activeMenuItem === MENU_ITEMS.LASER) {
            isLaserPointing.current = true;
            localLaserTrailRef.current = [...localLaserTrailRef.current, { x, y, t: Date.now() }];
            startLaserAging();
            if (roomJoined && shareId) emitLaserPointRef.current(shareId, x, y);
            return;
        }
    };

    return {
        handlePointerDown,
    };
};
