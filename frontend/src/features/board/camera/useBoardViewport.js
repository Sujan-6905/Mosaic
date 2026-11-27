import { buildSnapshot } from "../rendering/perfHarness";
import { cameraToFit } from "./viewport";
import { getElementBounds, getUnionBounds, unionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { getLodLevel } from "../rendering/lod";
import { invalidateColorCache } from "../rendering/colorResolver";
import { socket } from "@/lib/socket.js";
import { useCallback, useEffect, useRef } from "react";
import { COMPACT_BOARD_QUERY } from "../chrome/useCompactBoard";
import { viewportWorldBounds, zoomAtScreenPoint } from "./camera";

export const useBoardViewport = (board) => {
    const {
        activeMenuItem,
        cameraRef,
        debugMode,
        disambiguationClearGuardRef,
        elementVersionsRef,
        elements,
        frameCounterRef,
        frameTimesRef,
        hasAppliedSearchFocusRef,
        lastFrameTimestampRef,
        paintTimesRef,
        pendingCommentAnchor,
        perfMode,
        requestStaticFullRepaint,
        roomJoined,
        router,
        selectedElementIds,
        setAiDisambiguation,
        setCamera,
        setDebugStats,
        setElements,
        setPendingCommentAnchor,
        socketMessageCounterRef,
        spatialIndexRef,
        staticInsertDrainCounterRef,
        staticNeedsFullRepaintRef,
        staticRepaintCounterRef,
        tileRenderer,
        totalElementCountRef,
        viewportSize,
        viewportSizeRef,
        visibleElementCountRef,
    } = board;

    // A theme change clears the colour cache and repaints the board once, the only way token-coloured ink changes.
    useEffect(() => {
        const handleThemeChanged = () => {
            invalidateColorCache();
            tileRenderer.invalidateAll();
            requestStaticFullRepaint(elements);
        };
        window.addEventListener("mosaic:theme-changed", handleThemeChanged);
        return () => window.removeEventListener("mosaic:theme-changed", handleThemeChanged);
    }, [elements, requestStaticFullRepaint, tileRenderer]);

    // Escape drops a comment box that hasn't been posted yet.
    useEffect(() => {
        if (!pendingCommentAnchor) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") setPendingCommentAnchor(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pendingCommentAnchor, setPendingCommentAnchor]);

    // Samples the frame loop's counters into state once a second for the ?debug=1 readout.
    useEffect(() => {
        if (!debugMode) return;
        const interval = setInterval(() => {
            setDebugStats({
                fps: frameCounterRef.current,
                staticRepaintsPerSec: staticRepaintCounterRef.current,
                staticInsertDrainsPerSec: staticInsertDrainCounterRef.current,
                visibleElementCount: visibleElementCountRef.current,
                totalElementCount: totalElementCountRef.current,
                lodLevel: getLodLevel(cameraRef.current.zoom, visibleElementCountRef.current),
            });
            frameCounterRef.current = 0;
            staticRepaintCounterRef.current = 0;
            staticInsertDrainCounterRef.current = 0;
        }, 1000);
        return () => clearInterval(interval);
    }, [
        debugMode,
        cameraRef,
        frameCounterRef,
        setDebugStats,
        staticInsertDrainCounterRef,
        staticRepaintCounterRef,
        totalElementCountRef,
        visibleElementCountRef,
    ]);

    // With ?perf=1, perf/run.mjs drives the board through window.__mosaicPerf; without it nothing is attached.
    useEffect(() => {
        if (!perfMode || typeof window === "undefined") return;
        window.__mosaicPerf = {
            // Replaces the local board without emitting anything, so a huge
            // scene measures rendering alone and never reaches the database.
            loadElements: (nextElements) => {
                setElements(nextElements);
                requestStaticFullRepaint(nextElements);
                spatialIndexRef.current.load(nextElements);
                elementVersionsRef.current = Object.fromEntries(Object.entries(nextElements).map(([id, el]) => [id, el.version || 0]));
            },
            setCamera,
            getCamera: () => cameraRef.current,
            getViewportSize: () => viewportSizeRef.current,
            isViewFinished: () => !staticNeedsFullRepaintRef.current,
            // Runs the real socket handlers, as if the server had sent this.
            deliverSocketEvent: (event, payload) => socket.listeners(event).forEach((listener) => listener(payload)),
            reset: () => {
                frameTimesRef.current = [];
                paintTimesRef.current = [];
                lastFrameTimestampRef.current = null;
                staticRepaintCounterRef.current = 0;
                staticInsertDrainCounterRef.current = 0;
                socketMessageCounterRef.current = 0;
            },
            snapshot: () =>
                buildSnapshot({
                    frameTimes: frameTimesRef.current,
                    paintTimes: paintTimesRef.current,
                    staticRepaints: staticRepaintCounterRef.current,
                    staticInsertDrains: staticInsertDrainCounterRef.current,
                    socketMessageCount: socketMessageCounterRef.current,
                    visibleElementCount: visibleElementCountRef.current,
                    totalElementCount: spatialIndexRef.current.size(),
                }),
        };
        return () => {
            delete window.__mosaicPerf;
        };
    }, [
        perfMode,
        elements,
        setCamera,
        requestStaticFullRepaint,
        cameraRef,
        elementVersionsRef,
        frameTimesRef,
        lastFrameTimestampRef,
        paintTimesRef,
        setElements,
        socketMessageCounterRef,
        spatialIndexRef,
        staticInsertDrainCounterRef,
        staticNeedsFullRepaintRef,
        staticRepaintCounterRef,
        visibleElementCountRef,
        viewportSizeRef,
    ]);

    const ZOOM_STEP = 1.25;

    // Button-triggered zoom anchors at the viewport center (the wheel
    // handler below anchors at the cursor instead: see handleWheel).
    const handleZoomIn = useCallback(() => {
        setCamera((prev) => zoomAtScreenPoint(prev, viewportSize.width / 2, viewportSize.height / 2, prev.zoom * ZOOM_STEP));
    }, [setCamera, viewportSize]);
    const handleZoomOut = useCallback(() => {
        setCamera((prev) => zoomAtScreenPoint(prev, viewportSize.width / 2, viewportSize.height / 2, prev.zoom / ZOOM_STEP));
    }, [setCamera, viewportSize]);
    // Back to the origin at 100%, for when zoom to fit is thrown off by one stray element.
    const handleZoomReset = useCallback(() => {
        setCamera({ x: 0, y: 0, zoom: 1 });
    }, [setCamera]);
    const handleZoomToFit = useCallback(() => {
        const bounds = getUnionBounds(Object.values(elements));
        const next = cameraToFit(bounds, viewportSize.width, viewportSize.height);
        if (next) setCamera(next);
    }, [elements, viewportSize, setCamera]);
    const handleZoomToSelection = useCallback(() => {
        const bounds = getUnionBounds(selectedElementIds.map((id) => elements[id]));
        const next = cameraToFit(bounds, viewportSize.width, viewportSize.height, 120);
        if (next) setCamera(next);
    }, [elements, selectedElementIds, viewportSize, setCamera]);
    const getViewportBounds = useCallback(
        () => viewportWorldBounds(cameraRef.current, viewportSizeRef.current.width, viewportSizeRef.current.height),
        [cameraRef, viewportSizeRef],
    );
    const recenterCameraOn = useCallback(
        (worldX, worldY) => {
            setCamera((prev) => ({ ...prev, x: worldX - viewportSize.width / 2 / prev.zoom, y: worldY - viewportSize.height / 2 / prev.zoom }));
        },
        [setCamera, viewportSize],
    );
    // An indicator's target can span two far-apart clusters, so the camera fits the whole target rather than centring on it.
    const jumpToOffscreenBounds = useCallback(
        (bounds) => {
            const next = cameraToFit(bounds, viewportSize.width, viewportSize.height, 120);
            if (next) setCamera(next);
        },
        [viewportSize, setCamera],
    );

    // Brings something into view without magnifying it past actual size, which
    // would be disorienting for a single small element.
    const showWorldBounds = useCallback(
        (bounds) => {
            const fitted = cameraToFit(bounds, viewportSize.width, viewportSize.height, 120);
            if (!fitted) return;
            if (fitted.zoom <= 1) {
                setCamera(fitted);
                return;
            }
            setCamera({
                zoom: 1,
                x: (bounds.minX + bounds.maxX) / 2 - viewportSize.width / 2,
                y: (bounds.minY + bounds.maxY) / 2 - viewportSize.height / 2,
            });
        },
        [viewportSize, setCamera],
    );

    // Brings every candidate of an assistant question into view, but only pans when one is actually off screen.
    const handleAiDisambiguationChange = useCallback(
        (next) => {
            setAiDisambiguation(next);
            if (!next || next.candidates.length === 0) return;

            const visible = viewportWorldBounds(cameraRef.current, viewportSize.width, viewportSize.height);
            const allVisible = next.candidates.every(
                (candidate) =>
                    candidate.bounds.minX >= visible.minX &&
                    candidate.bounds.maxX <= visible.maxX &&
                    candidate.bounds.minY >= visible.minY &&
                    candidate.bounds.maxY <= visible.maxY,
            );
            if (allVisible) return;

            jumpToOffscreenBounds(unionBounds(next.candidates.map((candidate) => candidate.bounds)));
        },
        [viewportSize, jumpToOffscreenBounds, cameraRef, setAiDisambiguation],
    );
    useEffect(() => {
        if (disambiguationClearGuardRef.current) {
            disambiguationClearGuardRef.current = false;
            return;
        }
        setAiDisambiguation(null);
    }, [selectedElementIds, activeMenuItem, disambiguationClearGuardRef, setAiDisambiguation]);
    useEffect(() => {
        if (!roomJoined || hasAppliedSearchFocusRef.current) return;
        const { focusElementId, focusX, focusY } = router.query;
        if (!focusElementId && focusX === undefined) return;

        hasAppliedSearchFocusRef.current = true;
        const target = focusElementId ? getElementBounds(elements[focusElementId]) : null;
        const worldX = target ? (target.minX + target.maxX) / 2 : Number(focusX);
        const worldY = target ? (target.minY + target.maxY) / 2 : Number(focusY);
        if (Number.isFinite(worldX) && Number.isFinite(worldY)) {
            recenterCameraOn(worldX, worldY);
        }

        const { focusElementId: _f, focusX: _x, focusY: _y, ...rest } = router.query;
        router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }, [roomJoined, elements, router, recenterCameraOn, hasAppliedSearchFocusRef]);

    // A phone or tablet opens a board on all of its content, never zoomed in, rather than at 100% on the origin, where a few
    // boxes fill the screen. Content that already fits is left as it is.
    const fittedOnOpenRef = useRef(false);
    useEffect(() => {
        if (!roomJoined || fittedOnOpenRef.current || !viewportSize.width || !viewportSize.height) return;
        if (router.query.focusElementId || router.query.focusX !== undefined) return;
        fittedOnOpenRef.current = true;
        if (!window.matchMedia(`${COMPACT_BOARD_QUERY}, (pointer: coarse)`).matches) return;
        const bounds = getUnionBounds(Object.values(elements));
        if (!bounds) return;
        const view = viewportWorldBounds(cameraRef.current, viewportSize.width, viewportSize.height);
        if (bounds.minX >= view.minX && bounds.minY >= view.minY && bounds.maxX <= view.maxX && bounds.maxY <= view.maxY) return;
        const zoom = Math.min(cameraToFit(bounds, viewportSize.width, viewportSize.height, 72).zoom, 1);
        setCamera({
            x: (bounds.minX + bounds.maxX) / 2 - viewportSize.width / 2 / zoom,
            y: (bounds.minY + bounds.maxY) / 2 - viewportSize.height / 2 / zoom,
            zoom,
        });
    }, [roomJoined, elements, router.query, viewportSize, cameraRef, setCamera]);

    return {
        getViewportBounds,
        handleAiDisambiguationChange,
        handleZoomIn,
        handleZoomOut,
        handleZoomReset,
        handleZoomToFit,
        handleZoomToSelection,
        jumpToOffscreenBounds,
        recenterCameraOn,
        showWorldBounds,
    };
};
