import { MENU_ITEMS } from "../tools/toolSettings";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { panByScreenDelta, zoomAtScreenPoint } from "../camera/camera";
import { isClosedShape } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { isBoardChrome } from "../state/boardHelpers";
import { nextDrillStep } from "../selection/drillSelection";
import { PIECE_DRAG_TYPE } from "../pieces/piecesApi";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { cellAt } from "../text/tableLayout";

const MOUSE_WHEEL_DELTA = 50;

// Moves, releases and cancels are heard on window, so a drag keeps tracking over the dock and panels.
const LISTENERS = [
    ["container", ["pointerdown", "wheel", "contextmenu"], { passive: false }],
    ["container", ["dblclick", "dragstart", "selectstart", "dragover", "drop"], undefined],
    ["window", ["pointermove", "pointerup"], { passive: false }],
    ["window", ["pointercancel"], undefined],
];

const listenOn = (container, handlersRef) => {
    const attached = LISTENERS.flatMap(([where, types, options]) =>
        types.map((type) => [where === "window" ? window : container, type, (event) => handlersRef.current[type](event), options]),
    );
    attached.forEach(([target, type, listener, options]) => target.addEventListener(type, listener, options));
    return () => attached.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
};
const DROP_STAGGER = 24;

export const useBoardGestures = (board) => {
    const {
        createText,
        dropPiece,
        enteredGroupIdRef,
        getElementStackAtPoint,
        handleContextMenu,
        insertImageFile,
        lastPointerClientRef,
        selectedElementIds,
        selectionBeforePressRef,
        setActiveEmbedId,
        setRenamingFrameId,
        activeMenuItem,
        containerRef,
        elements,
        getCanvasCoordinates,
        getElementAtPoint,
        getSelectionTolerance,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        hasEditAccess,
        openTextEditor,
        setCamera,
        setSelectedElementIds,
    } = board;

    // A mouse wheel steps in whole notches and zooms; a trackpad's two-finger
    // scroll arrives as small deltas and pans. Pinch reports as ctrl+wheel.
    const handleWheel = useCallback(
        (e) => {
            if (isBoardChrome(e.target)) return;
            e.preventDefault();
            if (!containerRef.current) return;
            const isPinch = e.ctrlKey || e.metaKey;
            const looksLikeMouseWheel = Math.abs(e.deltaY) >= MOUSE_WHEEL_DELTA && e.deltaX === 0 && Number.isInteger(e.deltaY);
            if (!isPinch && !looksLikeMouseWheel) {
                setCamera((prev) => panByScreenDelta(prev, e.shiftKey ? -e.deltaY : -e.deltaX, e.shiftKey ? 0 : -e.deltaY));
                return;
            }
            const zoomFactor = isPinch ? 1.05 : 1.1;
            const delta = Math.sign(e.deltaY) * -1;
            if (delta === 0) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const cursorX = e.clientX - containerRect.left;
            const cursorY = e.clientY - containerRect.top;
            setCamera((prev) => zoomAtScreenPoint(prev, cursorX, cursorY, delta > 0 ? prev.zoom * zoomFactor : prev.zoom / zoomFactor));
        },
        [setCamera, containerRef],
    );

    const editElement = useCallback(
        (id, point) => {
            const hit = elements[id];
            if (!hit || hit.locked) return;
            if (hit.type === "table") {
                setSelectedElementIds([id]);
                openTextEditor(id, null, { cell: (point && cellAt(hit, point)) || { row: 0, col: 0 } });
            } else if (hit.type === "embed") setActiveEmbedId(id);
            else if (hit.type === "frame") setRenamingFrameId(id);
            else if (hit.type === "text" || hit.type === "sticky" || hit.type === "connector" || isClosedShape(hit)) {
                setSelectedElementIds([id]);
                openTextEditor(id);
            }
        },
        [elements, openTextEditor, setActiveEmbedId, setRenamingFrameId, setSelectedElementIds],
    );

    // Double-click opens a selection onto what's inside it, then edits whatever
    // carries words. On empty board it starts new text.
    const handleDoubleClick = useCallback(
        (e) => {
            if (activeMenuItem !== MENU_ITEMS.SELECT || isBoardChrome(e.target)) return;
            if (e.target?.closest?.("[data-selection-handle]") && !e.target.closest("[data-opens-label]")) return;
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            const stack = getElementStackAtPoint(x, y);
            const before = selectionBeforePressRef.current;
            const previous = before.some((id) => stack.includes(id)) ? before : selectedElementIds;
            const step = nextDrillStep(stack, previous, getElementAtPoint(x, y, getSelectionTolerance));
            if (step?.select) {
                enteredGroupIdRef.current = elements[step.select]?.groupId ?? null;
                setSelectedElementIds([step.select]);
                return;
            }
            if (!hasEditAccess) return;
            if (step?.edit) {
                editElement(step.edit, { x, y });
                return;
            }
            const union = previous.length > 1 ? getUnionBounds(previous.map((id) => elements[id]).filter(Boolean)) : null;
            const insideSelection = union && x >= union.minX && x <= union.maxX && y >= union.minY && y <= union.maxY;
            if (!insideSelection) createText(x, y);
        },
        [
            activeMenuItem,
            hasEditAccess,
            getCanvasCoordinates,
            getElementAtPoint,
            getElementStackAtPoint,
            getSelectionTolerance,
            elements,
            selectedElementIds,
            selectionBeforePressRef,
            enteredGroupIdRef,
            editElement,
            setSelectedElementIds,
            createText,
        ],
    );

    // A native drag or a text selection has no business starting on the board,
    // and the first of those ends a gesture in pointercancel.
    const blockNativeGestures = useCallback((e) => {
        const target = e.target;
        if (isBoardChrome(target) || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
    }, []);

    // A cancelled gesture finishes as if released at its last known position,
    // since the event itself reports none.
    const handlePointerCancel = useCallback(
        (e) => {
            const last = lastPointerClientRef.current;
            handlePointerUp({ pointerId: e.pointerId, pointerType: e.pointerType, clientX: last?.x ?? 0, clientY: last?.y ?? 0, target: e.target });
        },
        [handlePointerUp, lastPointerClientRef],
    );

    const handleDragOver = useCallback((e) => {
        if (e.dataTransfer?.types?.includes("Files") || e.dataTransfer?.types?.includes(PIECE_DRAG_TYPE)) e.preventDefault();
    }, []);

    const handleDrop = useCallback(
        (e) => {
            const piece = e.dataTransfer?.getData(PIECE_DRAG_TYPE);
            if (piece && hasEditAccess) {
                e.preventDefault();
                dropPiece(JSON.parse(piece), getCanvasCoordinates(e.clientX, e.clientY));
                return;
            }
            const images = [...(e.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith("image/"));
            if (images.length === 0 || !hasEditAccess) return;
            e.preventDefault();
            const point = getCanvasCoordinates(e.clientX, e.clientY);
            images.forEach((file, index) => insertImageFile(file, { x: point.x + index * DROP_STAGGER, y: point.y + index * DROP_STAGGER }));
        },
        [hasEditAccess, getCanvasCoordinates, insertImageFile, dropPiece],
    );

    // Mouse, touch and pen arrive as one pointer stream, which is what makes pressure and pinch possible.
    // Listeners attach once and call the latest handlers, so an event right after a state change never runs a stale one.
    const handlersRef = useRef(null);
    useLayoutEffect(() => {
        handlersRef.current = {
            pointerdown: handlePointerDown,
            pointermove: handlePointerMove,
            pointerup: handlePointerUp,
            pointercancel: handlePointerCancel,
            wheel: handleWheel,
            contextmenu: handleContextMenu,
            dblclick: handleDoubleClick,
            dragstart: blockNativeGestures,
            selectstart: blockNativeGestures,
            dragover: handleDragOver,
            drop: handleDrop,
        };
    });

    // Re-checked after every render, because the container only mounts once the board has loaded.
    const attachedRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (attachedRef.current?.container === container) return;
        attachedRef.current?.detach();
        attachedRef.current = container ? { container, detach: listenOn(container, handlersRef) } : null;
    });
    // Cleared on unmount so a remount (StrictMode runs effects twice) attaches again.
    useEffect(
        () => () => {
            attachedRef.current?.detach();
            attachedRef.current = null;
        },
        [],
    );
};
