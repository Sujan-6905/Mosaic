import { createTileRenderer, findChangedElements } from "./tileRenderer";
import { getPaintBounds } from "./boundsCache";
import { getVisibleElementIds } from "../camera/viewport";
import { paintBackground } from "./backgroundRenderer";
import { paintElement } from "./elementPainter";
import { useCallback, useRef, useState } from "react";
import { viewportWorldBounds } from "../camera/camera";
import { MAX_TILE_INVALIDATIONS } from "../state/boardHelpers";

// The element under edit is drawn at the size its text is pushing it to, without
// the words themselves, whose only visible copy is the textarea above it.
const asBeingEdited = (element, geometry) => ({ ...element, ...geometry, text: "", subtext: "" });

export const useBoardPainting = (board) => {
    const {
        background,
        cameraRef,
        contextRef,
        debugMode,
        drawZoom,
        editingGeometryRef,
        editingTextIdRef,
        elementsRef,
        hiddenStaticElementIdsRef,
        overlayContextRef,
        paintOrder,
        pendingFullRepaintSnapshotRef,
        pendingInsertsForRepaintRef,
        perfMode,
        previewHiddenIdsRef,
        requestStaticFullRepaint,
        spatialIndexRef,
        staticInsertDrainCounterRef,
        staticNeedsFullRepaintRef,
        staticPendingInsertsRef,
        staticRepaintCounterRef,
        tileChangedIdsRef,
        tileDrawZoomRef,
        tileRendererRef,
        tiledHiddenIdsRef,
        tiledOnTopRef,
        tiledSnapshotRef,
        totalElementCountRef,
        viewportSize,
        visibleElementCountRef,
    } = board;

    const handleImageLoaded = useCallback(() => {
        tileRendererRef.current?.invalidateAll();
        requestStaticFullRepaint(elementsRef.current);
    }, [tileRendererRef, requestStaticFullRepaint, elementsRef]);

    // `elementsOverride` lets a live drag draw connectors against where their
    // targets are this frame, not where React last committed them.
    const drawElement = useCallback(
        (context, element, elementsOverride) => {
            paintElement(context, element, { elements: elementsOverride ?? elementsRef.current, zoom: drawZoom(), onImageLoad: handleImageLoaded });
        },
        [drawZoom, elementsRef, handleImageLoaded],
    );

    // Drawn by zIndex from low to high, so a higher element's ink is always on top.
    const drawElementRef = useRef(drawElement);
    drawElementRef.current = drawElement;

    // Resets, clears in device pixels, then applies the camera as the context transform; elements draw in world space.
    const applyCameraTransform = useCallback(
        (context) => {
            const dpr = window.devicePixelRatio || 1;
            const cam = cameraRef.current;
            context.setTransform(cam.zoom * dpr, 0, 0, cam.zoom * dpr, -cam.x * cam.zoom * dpr, -cam.y * cam.zoom * dpr);
        },
        [cameraRef],
    );
    const clearAndApplyCameraTransform = useCallback(
        (context) => {
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            applyCameraTransform(context);
        },
        [applyCameraTransform],
    );

    const [tileRenderer] = useState(() =>
        createTileRenderer({
            collectElements: (worldRect) => {
                const ids = spatialIndexRef.current
                    .queryRect(worldRect)
                    .filter((id) => !hiddenStaticElementIdsRef.current.has(id) && !previewHiddenIdsRef.current.has(id));
                return paintOrder.entriesFor(pendingFullRepaintSnapshotRef.current, ids);
            },
            paintElements: (context, entries, zoom) => {
                tileDrawZoomRef.current = zoom;
                entries.forEach(([id, element]) =>
                    drawElementRef.current(context, id === editingTextIdRef.current ? asBeingEdited(element, editingGeometryRef.current) : element),
                );
                tileDrawZoomRef.current = null;
            },
            createCanvas: (width, height) => {
                if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
                return Object.assign(document.createElement("canvas"), { width, height });
            },
        }),
    );
    tileRendererRef.current = tileRenderer;

    // Redraws only the tiles under a real change between what the tiles last saw and the snapshot now due.
    // Hidden ids count as changes, so a dragged element's old position isn't left under the overlay's copy.
    const invalidateChangedTiles = useCallback(() => {
        const previous = tiledSnapshotRef.current;
        const next = pendingFullRepaintSnapshotRef.current;
        const invalidateElement = (element) => {
            const bounds = element && getPaintBounds(element);
            if (bounds) tileRenderer.invalidateBounds(bounds);
        };
        if (previous !== next) {
            const changed = findChangedElements(previous, next, tiledOnTopRef.current, tileChangedIdsRef.current);
            if (changed.length > MAX_TILE_INVALIDATIONS) tileRenderer.invalidateAll();
            else changed.forEach(invalidateElement);
            tiledSnapshotRef.current = next;
            tiledOnTopRef.current.clear();
            tileChangedIdsRef.current = new Set();
        }
        const hiddenBefore = tiledHiddenIdsRef.current;
        const hiddenNow = new Set([...hiddenStaticElementIdsRef.current, ...previewHiddenIdsRef.current]);
        hiddenBefore.forEach((id) => hiddenNow.has(id) || invalidateElement(next[id]));
        hiddenNow.forEach((id) => hiddenBefore.has(id) || invalidateElement(next[id]));
        tiledHiddenIdsRef.current = hiddenNow;
    }, [
        tileRenderer,
        hiddenStaticElementIdsRef,
        pendingFullRepaintSnapshotRef,
        previewHiddenIdsRef,
        tileChangedIdsRef,
        tiledHiddenIdsRef,
        tiledOnTopRef,
        tiledSnapshotRef,
    ]);

    const paintStaticFull = useCallback(() => {
        const context = contextRef.current;
        if (!context) return;
        clearAndApplyCameraTransform(context);
        paintBackground(context, cameraRef.current, viewportSize.width, viewportSize.height, background);
        if (pendingInsertsForRepaintRef.current.length > 0) {
            const snapshot = { ...pendingFullRepaintSnapshotRef.current };
            pendingInsertsForRepaintRef.current.forEach(({ elementId, element }) => {
                snapshot[elementId] = element;
                tileChangedIdsRef.current?.add(elementId);
            });
            pendingInsertsForRepaintRef.current = [];
            pendingFullRepaintSnapshotRef.current = snapshot;
        }
        invalidateChangedTiles();

        const finished = tileRenderer.composite(context, cameraRef.current, window.devicePixelRatio || 1, viewportSize.width, viewportSize.height);
        if (!finished) staticNeedsFullRepaintRef.current = true;
        applyCameraTransform(context);

        if (debugMode || perfMode) {
            visibleElementCountRef.current = getVisibleElementIds(
                spatialIndexRef.current,
                cameraRef.current,
                viewportSize.width,
                viewportSize.height,
                0,
            ).length;
            totalElementCountRef.current = spatialIndexRef.current.size();
        }
        staticRepaintCounterRef.current += 1;
    }, [
        tileRenderer,
        invalidateChangedTiles,
        clearAndApplyCameraTransform,
        applyCameraTransform,
        viewportSize,
        background,
        debugMode,
        perfMode,
        cameraRef,
        contextRef,
        pendingFullRepaintSnapshotRef,
        pendingInsertsForRepaintRef,
        spatialIndexRef,
        staticNeedsFullRepaintRef,
        staticRepaintCounterRef,
        tileChangedIdsRef,
        totalElementCountRef,
        visibleElementCountRef,
    ]);

    // New elements draw straight on top with no clear, everything queued since the last frame in one pass.
    // One off screen is skipped this frame; a pan that reveals it repaints in full and picks it up.
    const drainStaticPendingInserts = useCallback(() => {
        const context = contextRef.current;
        const pending = staticPendingInsertsRef.current;
        if (!context || pending.length === 0) return;
        staticPendingInsertsRef.current = [];
        applyCameraTransform(context);
        const visible = viewportWorldBounds(cameraRef.current, viewportSize.width, viewportSize.height);
        pending.forEach(({ elementId, element }) => {
            const bounds = getPaintBounds(element);
            if (!bounds) return;
            tileRenderer.addToTop([elementId, element], bounds);
            tiledOnTopRef.current.set(elementId, element);
            if (bounds.maxX >= visible.minX && bounds.minX <= visible.maxX && bounds.maxY >= visible.minY && bounds.minY <= visible.maxY) {
                drawElement(context, element);
            }
        });
        staticInsertDrainCounterRef.current += 1;
    }, [
        drawElement,
        viewportSize,
        tileRenderer,
        applyCameraTransform,
        cameraRef,
        contextRef,
        staticInsertDrainCounterRef,
        staticPendingInsertsRef,
        tiledOnTopRef,
    ]);

    const clearOverlayCanvas = useCallback(() => {
        const context = overlayContextRef.current;
        if (!context) return;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }, [overlayContextRef]);

    return {
        clearAndApplyCameraTransform,
        clearOverlayCanvas,
        drainStaticPendingInserts,
        drawElement,
        paintStaticFull,
        tileRenderer,
    };
};
