import { createSpatialIndex } from "../camera/spatialIndex";
import { socket } from "@/lib/socket.js";
import { useRef } from "react";
import { throttle } from "./boardHelpers";

export const useBoardRefs = () => {
    const canvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const containerRef = useRef(null);
    const contextRef = useRef(null);
    const overlayContextRef = useRef(null);
    const shouldDraw = useRef(false);
    const isDrawing = useRef(false);
    const isDrawingShape = useRef(false);
    const isPanning = useRef(false);
    // A Ctrl-press on an element: a pan if the pointer moves, a selection toggle if it doesn't.
    const ctrlClickTargetRef = useRef(null);
    const isErasing = useRef(false);
    const lastPanPoint = useRef({ x: 0, y: 0 });
    const currentPath = useRef([]);
    const currentElementId = useRef(null);
    const initialShapePoint = useRef(null);
    // { mode: "move" | "resize" | "rotate" | "marquee" | "lasso", ids, originalElements, ... }.
    // Resize holds one id; every other mode works on the whole selection.
    const dragStateRef = useRef(null);
    // Touch pointerId -> last client {x, y}. A third touch (a resting palm) is tracked but never starts a gesture.
    const activeTouchPointersRef = useRef(new Map());
    // While two fingers are down: their starting distance, midpoint and camera, which each move is measured against.
    const pinchGestureRef = useRef(null);
    // After a pinch ends, keeps the finger still on the glass from starting a stroke until it lifts too.
    const suppressTouchDrawRef = useRef(false);
    // Pointer-down's two-finger branch ends a gesture through pointer-up, which is built after it.
    const handlePointerUpRef = useRef(null);
    // Copied elements as full snapshots, so a paste survives the originals being edited or deleted.
    const clipboardRef = useRef([]);
    // World x and y of the snap guides shown during a move, or null.
    const snapGuidesRef = useRef({ x: null, y: null });
    // elementId -> last version the server confirmed. Outlives a deleted element, so a stale update still loses to the delete.
    const elementVersionsRef = useRef({});
    // elementId -> the server's copy this client last adopted, so an update can name the fields it changed.
    const confirmedElementsRef = useRef({});
    const spatialIndexRef = useRef(createSpatialIndex());

    // Painting runs off these refs in one animation-frame loop. A repaint is handed the exact snapshot to draw,
    // because a ref mirrored from state by an effect can lag the frame and paint stale data.
    const pendingFullRepaintSnapshotRef = useRef({});
    const pendingInsertsForRepaintRef = useRef([]);
    const tiledSnapshotRef = useRef({});
    const tiledHiddenIdsRef = useRef(new Set());
    const previewHiddenIdsRef = useRef(new Set());
    const tiledOnTopRef = useRef(new Map());
    const tileChangedIdsRef = useRef(new Set());
    const tileRendererRef = useRef(null);
    const remoteElementChangesRef = useRef([]);
    const remoteRepaintNeededRef = useRef(false);
    // A full repaint is the only way to erase pixels; pending inserts never had any, so they draw without a clear.
    const staticNeedsFullRepaintRef = useRef(true);
    const staticPendingInsertsRef = useRef([]);
    // Ids being dragged, resized or rotated, which the overlay draws instead of the board layer.
    const hiddenStaticElementIdsRef = useRef(new Set());
    const editingTextIdRef = useRef(null);
    const editingGeometryRef = useRef(null);
    const lastDuplicateRef = useRef(null);
    const hoverTargetRef = useRef(null);
    const enteredGroupIdRef = useRef(null);
    const selectionBeforePressRef = useRef([]);
    const lastSelectPressAtRef = useRef(0);
    // null | "stroke" | "shape" | "drag" | "marquee" | "lasso" | "erase": the one kind of content in progress.
    const overlayModeRef = useRef(null);
    // What the overlay mode draws each frame: an element, the dragged elements, a marquee rect, lasso points or erased ids.
    const overlayShapeRef = useRef(null);
    // Elements the eraser has crossed, shown blurred until the pointer lifts and they are removed.
    const eraserPendingIdsRef = useRef(new Set());
    // Timed points behind the eraser, drawn as a fading trail.
    const eraserTrailRef = useRef([]);
    const currentStrokeStyleRef = useRef(null);
    // Without real pen pressure, a stroke's width comes from its speed.
    const currentStrokeUsesRealPressureRef = useRef(false);

    const isDrawingFrame = useRef(false);
    // A connector's start as { x, y, elementId }, with a null elementId for a free end.
    const isDrawingConnector = useRef(false);
    const connectorStart = useRef(null);
    // The laser is only broadcast, never stored, undone or saved.
    const isLaserPointing = useRef(false);
    const localLaserTrailRef = useRef([]);
    const remoteLaserTrailsRef = useRef({});
    const laserAgingRafRef = useRef(null);
    const tidyAnimationFrameRef = useRef(null);
    const textCollabSessionRef = useRef(null);
    const fileInputRef = useRef(null);
    // Where the image tool was clicked, so the image lands there once its upload finishes.
    const pendingImagePlacementRef = useRef(null);

    // Counters for the ?debug=1 readout, sampled once a second so counting never re-renders.
    const frameCounterRef = useRef(0);
    const staticRepaintCounterRef = useRef(0);
    const staticInsertDrainCounterRef = useRef(0);
    const visibleElementCountRef = useRef(0);
    const totalElementCountRef = useRef(0);

    // Samples for perf/run.mjs, exposed on window with ?perf=1.
    const frameTimesRef = useRef([]);
    const paintTimesRef = useRef([]);
    const lastFrameTimestampRef = useRef(null);
    const socketMessageCounterRef = useRef(0);
    // The live board for paint callbacks, so they need not be rebuilt on every element change.
    const elementsRef = useRef({});
    // Held Ctrl+Z repeats faster than React renders, so the stacks live in refs every press mutates directly.
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    // { x, y, zoom }: the world point at the screen's top-left, and the scale (1 is 100%).
    const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
    // A tile is drawn at its own level's zoom, which isn't the camera's while a zoom is moving.
    const tileDrawZoomRef = useRef(null);
    const followingSocketIdRef = useRef(null);
    // True while following someone moves the camera, so only a person's own pan or zoom stops following.
    const isFollowUpdateRef = useRef(false);
    // True from each client:joinRoom emit until the server answers it, so a
    // canvasAccessDenied in that window reads as the join being refused.
    const awaitingJoinRef = useRef(false);

    // Remote cameras and cursors arrive about 30 times a second, too often for state.
    const remoteCameraRef = useRef({});
    const remoteCursorsRef = useRef({});
    const participantsRef = useRef({});
    const cursorRafScheduled = useRef(false);

    const emitCursorMoveRef = useRef(
        throttle((shareId, x, y) => {
            socket.emit("client:cursorMove", { shareId, x, y });
        }, 33),
    );
    const emitLaserPointRef = useRef(
        throttle((shareId, x, y) => {
            socket.emit("client:laserPoint", { shareId, x, y });
        }, 33),
    );
    const emitCameraMoveRef = useRef(
        throttle((shareId, x, y, zoom) => {
            socket.emit("client:cameraMove", { shareId, x, y, zoom });
        }, 33),
    );
    const pendingElementUpdatesRef = useRef(new Map());
    const elementUpdateFlushTimerRef = useRef(null);
    const elementUpdateLastFlushRef = useRef(0);

    // An assistant question's highlights clear once someone selects or switches tool, since they have moved on.
    const disambiguationClearGuardRef = useRef(true);

    // A search result's ?focusElementId= is followed once, so a refresh doesn't snap back to it.
    const hasAppliedSearchFocusRef = useRef(false);
    const textEditFlushTimerRef = useRef(null);
    const hasAutoLaunchedTourRef = useRef(false);

    const lastPointerClientRef = useRef(null);
    const lastPointerWorldRef = useRef(null);
    const spaceHeldRef = useRef(false);
    const bindTargetRef = useRef(null);

    return {
        lastPointerClientRef,
        lastPointerWorldRef,
        spaceHeldRef,
        bindTargetRef,
        activeTouchPointersRef,
        awaitingJoinRef,
        cameraRef,
        canvasRef,
        clipboardRef,
        connectorStart,
        containerRef,
        contextRef,
        currentElementId,
        currentPath,
        currentStrokeStyleRef,
        currentStrokeUsesRealPressureRef,
        cursorRafScheduled,
        disambiguationClearGuardRef,
        dragStateRef,
        elementUpdateFlushTimerRef,
        elementUpdateLastFlushRef,
        elementVersionsRef,
        confirmedElementsRef,
        elementsRef,
        emitCameraMoveRef,
        emitCursorMoveRef,
        emitLaserPointRef,
        eraserPendingIdsRef,
        eraserTrailRef,
        fileInputRef,
        followingSocketIdRef,
        frameCounterRef,
        frameTimesRef,
        handlePointerUpRef,
        hasAppliedSearchFocusRef,
        hasAutoLaunchedTourRef,
        hiddenStaticElementIdsRef,
        editingTextIdRef,
        editingGeometryRef,
        lastDuplicateRef,
        hoverTargetRef,
        enteredGroupIdRef,
        lastSelectPressAtRef,
        selectionBeforePressRef,
        initialShapePoint,
        isDrawing,
        isDrawingConnector,
        isDrawingFrame,
        isDrawingShape,
        isErasing,
        isFollowUpdateRef,
        isLaserPointing,
        isPanning,
        ctrlClickTargetRef,
        laserAgingRafRef,
        lastFrameTimestampRef,
        lastPanPoint,
        localLaserTrailRef,
        overlayCanvasRef,
        overlayContextRef,
        overlayModeRef,
        overlayShapeRef,
        paintTimesRef,
        participantsRef,
        pendingElementUpdatesRef,
        pendingFullRepaintSnapshotRef,
        pendingImagePlacementRef,
        pendingInsertsForRepaintRef,
        pinchGestureRef,
        previewHiddenIdsRef,
        redoStackRef,
        remoteCameraRef,
        remoteCursorsRef,
        remoteElementChangesRef,
        remoteLaserTrailsRef,
        remoteRepaintNeededRef,
        shouldDraw,
        snapGuidesRef,
        socketMessageCounterRef,
        spatialIndexRef,
        staticInsertDrainCounterRef,
        staticNeedsFullRepaintRef,
        staticPendingInsertsRef,
        staticRepaintCounterRef,
        suppressTouchDrawRef,
        textCollabSessionRef,
        textEditFlushTimerRef,
        tidyAnimationFrameRef,
        tileChangedIdsRef,
        tileDrawZoomRef,
        tileRendererRef,
        tiledHiddenIdsRef,
        tiledOnTopRef,
        tiledSnapshotRef,
        totalElementCountRef,
        undoStackRef,
        visibleElementCountRef,
    };
};
