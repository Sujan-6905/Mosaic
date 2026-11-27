import { elementOutlineWorld } from "../../../../../shared/canvas/elements/connectors";
import { fillStrokeOutline, getStrokeOutline, resolveStrokePressures } from "./strokeRenderer";
import { pushBounded } from "./perfHarness";
import { resolveElementColor } from "./colorResolver";
import { useCallback, useEffect } from "react";
import { viewportWorldBounds } from "../camera/camera";
import { ERASER_TRAIL_MS } from "../state/boardHelpers";

export const useOverlayPainting = (board) => {
    const {
        bindTargetRef,
        dragStateRef,
        hoverTargetRef,
        cameraRef,
        cameraStore,
        clearAndApplyCameraTransform,
        currentPath,
        currentStrokeStyleRef,
        currentStrokeUsesRealPressureRef,
        drainStaticPendingInserts,
        drawElement,
        elementsRef,
        eraserPendingIdsRef,
        eraserTrailRef,
        flushRemoteElementChanges,
        frameCounterRef,
        frameTimesRef,
        lastFrameTimestampRef,
        overlayContextRef,
        overlayModeRef,
        overlayShapeRef,
        paintStaticFull,
        paintTimesRef,
        perfMode,
        size,
        snapGuidesRef,
        staticNeedsFullRepaintRef,
        staticPendingInsertsRef,
        viewportSize,
    } = board;

    // The element an arrow would attach to, outlined, with the point it would use.
    const paintBindTarget = useCallback(
        (context, target = bindTargetRef.current, lineWidthPx = 2) => {
            const element = target && elementsRef.current[target.elementId];
            if (!element) return;
            const zoom = cameraRef.current.zoom;
            const highlight = resolveElementColor("selection-handle", "#6366f1");
            context.save();
            context.strokeStyle = highlight;
            context.fillStyle = highlight;
            context.lineWidth = lineWidthPx / zoom;
            const outline = elementOutlineWorld(element);
            if (outline) {
                context.beginPath();
                outline.forEach((point, i) => (i === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
                context.closePath();
                context.stroke();
            }
            if (target.point) {
                context.beginPath();
                context.arc(target.point.x, target.point.y, 4 / zoom, 0, 2 * Math.PI);
                context.fill();
            }
            context.restore();
        },
        [bindTargetRef, elementsRef, cameraRef],
    );

    const paintOverlayFrame = useCallback(() => {
        const context = overlayContextRef.current;
        if (!context) return;
        const mode = overlayModeRef.current;

        if (mode === "stroke") {
            const strokeStyle = currentStrokeStyleRef.current;
            const rawPoints = currentPath.current;
            if (rawPoints.length < 2 || !strokeStyle) return;
            // A tapered outline depends on earlier points too, so a live stroke redraws whole every frame.
            const resolvedPoints = resolveStrokePressures(rawPoints, currentStrokeUsesRealPressureRef.current);
            const outline = getStrokeOutline(resolvedPoints, strokeStyle);
            clearAndApplyCameraTransform(context);
            context.save();
            context.fillStyle = strokeStyle.color;
            context.globalAlpha = strokeStyle.opacity / 100;
            fillStrokeOutline(context, outline);
            context.restore();
            return;
        }

        if (mode === "shape") {
            clearAndApplyCameraTransform(context);
            if (overlayShapeRef.current) drawElement(context, overlayShapeRef.current);
            paintBindTarget(context);
            return;
        }

        if (mode === "hover") {
            clearAndApplyCameraTransform(context);
            paintBindTarget(context, { elementId: hoverTargetRef.current }, 1.25);
            return;
        }

        if (mode === "bindHover") {
            clearAndApplyCameraTransform(context);
            paintBindTarget(context);
            return;
        }

        // "drag" carries an array (every currently dragged/rotated selected
        // element), even when that array holds exactly one.
        if (mode === "drag") {
            clearAndApplyCameraTransform(context);
            // Connectors measure against this frame's positions, not the last commit.
            const drag = dragStateRef.current;
            const live = drag?.latestElements ? Object.assign(Object.create(elementsRef.current), drag.latestElements, drag.liveConnectors) : undefined;
            (overlayShapeRef.current || []).forEach((element) => element && drawElement(context, element, live));
            paintBindTarget(context);
            // Snap guides span the whole view, so they read as alignment with the board, not a highlight.
            const guides = snapGuidesRef.current;
            if (guides.x !== null || guides.y !== null) {
                const viewBounds = viewportWorldBounds(cameraRef.current, viewportSize.width, viewportSize.height);
                context.save();
                context.strokeStyle = resolveElementColor("selection-handle", "#6366f1");
                context.lineWidth = 1 / cameraRef.current.zoom;
                if (guides.x !== null) {
                    context.beginPath();
                    context.moveTo(guides.x, viewBounds.minY);
                    context.lineTo(guides.x, viewBounds.maxY);
                    context.stroke();
                }
                if (guides.y !== null) {
                    context.beginPath();
                    context.moveTo(viewBounds.minX, guides.y);
                    context.lineTo(viewBounds.maxX, guides.y);
                    context.stroke();
                }
                context.restore();
            }
            return;
        }

        if (mode === "marquee" && overlayShapeRef.current) {
            clearAndApplyCameraTransform(context);
            const rect = overlayShapeRef.current;
            const minX = Math.min(rect.startX, rect.endX);
            const minY = Math.min(rect.startY, rect.endY);
            const width = Math.abs(rect.endX - rect.startX);
            const height = Math.abs(rect.endY - rect.startY);
            context.save();
            const zoom = cameraRef.current.zoom;
            context.lineWidth = 1 / zoom;
            context.setLineDash([6 / zoom, 4 / zoom]);
            context.strokeStyle = resolveElementColor("selection-handle", "#6366f1");
            context.fillStyle = resolveElementColor("selection-fill", "rgba(99, 102, 241, 0.12)");
            context.fillRect(minX, minY, width, height);
            context.strokeRect(minX, minY, width, height);
            context.restore();
            return;
        }

        // The lasso is drawn closed, as the release closes it when testing what's inside.
        if (mode === "lasso" && (overlayShapeRef.current?.length || 0) > 1) {
            clearAndApplyCameraTransform(context);
            const points = overlayShapeRef.current;
            context.save();
            const zoom = cameraRef.current.zoom;
            context.lineWidth = 1 / zoom;
            context.setLineDash([6 / zoom, 4 / zoom]);
            context.strokeStyle = resolveElementColor("selection-handle", "#6366f1");
            context.fillStyle = resolveElementColor("selection-fill", "rgba(99, 102, 241, 0.12)");
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
            context.closePath();
            context.fill();
            context.stroke();
            context.restore();
            return;
        }

        // Elements the eraser has crossed show blurred and dimmed until release deletes them, behind a fading trail.
        if (mode === "erase") {
            clearAndApplyCameraTransform(context);
            if (eraserPendingIdsRef.current.size > 0) {
                context.save();
                // Divided by zoom, so the blur looks the same on screen at every zoom.
                context.filter = `blur(${3 / cameraRef.current.zoom}px)`;
                context.globalAlpha = 0.5;
                eraserPendingIdsRef.current.forEach((elementId) => {
                    const element = elementsRef.current[elementId];
                    if (element) drawElement(context, element);
                });
                context.restore();
            }

            const now = performance.now();
            const trail = eraserTrailRef.current.filter((point) => now - point.t < ERASER_TRAIL_MS);
            eraserTrailRef.current = trail;
            if (trail.length > 1) {
                context.save();
                context.lineCap = "round";
                context.lineJoin = "round";
                context.strokeStyle = resolveElementColor("eraser-trail", "#9a9a9a");
                context.lineWidth = Math.max(size, 2);
                for (let i = 1; i < trail.length; i++) {
                    const age = (now - trail[i].t) / ERASER_TRAIL_MS;
                    context.globalAlpha = Math.max(0, 1 - age) * 0.6;
                    context.beginPath();
                    context.moveTo(trail[i - 1].x, trail[i - 1].y);
                    context.lineTo(trail[i].x, trail[i].y);
                    context.stroke();
                }
                context.restore();
            }
        }
    }, [
        paintBindTarget,
        dragStateRef,
        drawElement,
        clearAndApplyCameraTransform,
        viewportSize,
        size,
        cameraRef,
        currentPath,
        currentStrokeStyleRef,
        currentStrokeUsesRealPressureRef,
        elementsRef,
        eraserPendingIdsRef,
        eraserTrailRef,
        overlayContextRef,
        overlayModeRef,
        overlayShapeRef,
        snapGuidesRef,
        hoverTargetRef,
    ]);

    // The one frame loop for both canvases. Changes queue work through refs and the loop drains it,
    // so an idle frame costs a few ref reads.
    useEffect(() => {
        let frameId;
        const tick = () => {
            frameId = requestAnimationFrame(tick);
            frameCounterRef.current += 1;
            cameraStore.publish(cameraRef.current);
            flushRemoteElementChanges();

            if (perfMode) {
                const now = performance.now();
                if (lastFrameTimestampRef.current !== null) {
                    pushBounded(frameTimesRef.current, now - lastFrameTimestampRef.current);
                }
                lastFrameTimestampRef.current = now;
            }

            if (staticNeedsFullRepaintRef.current) {
                staticNeedsFullRepaintRef.current = false;
                staticPendingInsertsRef.current = [];
                if (perfMode) {
                    const paintStart = performance.now();
                    paintStaticFull();
                    pushBounded(paintTimesRef.current, performance.now() - paintStart);
                } else {
                    paintStaticFull();
                }
            } else if (staticPendingInsertsRef.current.length > 0) {
                drainStaticPendingInserts();
            }

            paintOverlayFrame();
        };
        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [
        paintStaticFull,
        drainStaticPendingInserts,
        paintOverlayFrame,
        perfMode,
        cameraStore,
        flushRemoteElementChanges,
        cameraRef,
        frameCounterRef,
        frameTimesRef,
        lastFrameTimestampRef,
        paintTimesRef,
        staticNeedsFullRepaintRef,
        staticPendingInsertsRef,
    ]);
};
