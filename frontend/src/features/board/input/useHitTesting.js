import { traceShape } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { worldPointToElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { connectorLabelPoint, resolveConnectorPolyline } from "../../../../../shared/canvas/elements/connectors";
import { screenToWorld } from "../camera/camera";
import { traceConnectorPath } from "../rendering/connectorPainter";
import { useCallback } from "react";

const LABEL_HIT_PADDING = 6;

export const isOnConnectorLabel = (context, connector, polyline, x, y) => {
    if (!connector.text || polyline.length < 2) return false;
    const fontSize = connector.fontSize || 13;
    context.font = `${fontSize}px ${connector.fontFamily || "Arial, sans-serif"}`;
    const center = connectorLabelPoint(connector, polyline);
    return (
        Math.abs(x - center.x) <= context.measureText(connector.text).width / 2 + LABEL_HIT_PADDING &&
        Math.abs(y - center.y) <= fontSize / 2 + LABEL_HIT_PADDING
    );
};

export const useHitTesting = (board) => {
    const { cameraRef, containerRef, contextRef, elements, paintOrder, size, spatialIndexRef } = board;

    const getCanvasCoordinates = useCallback(
        (clientX, clientY) => {
            if (!containerRef.current) return { x: 0, y: 0 };
            const rect = containerRef.current.getBoundingClientRect();
            return screenToWorld(cameraRef.current, clientX - rect.left, clientY - rect.top);
        },
        [cameraRef, containerRef],
    );

    // toleranceFn gives each element its own slack; the selection tool needs that, not the eraser's brush size.
    const getElementAtPoint = useCallback(
        (rawX, rawY, toleranceFn, acceptElement) => {
            const context = contextRef.current;
            if (!context) return null;
            // The paint loop leaves the camera transform set, and x, y are already world points, so reset first
            // or hits would depend on zoom.
            context.setTransform(1, 0, 0, 1, 0, 0);

            const defaultTolerance = size || 1;

            // The spatial index narrows the candidates before the precise path test. The margin is generous
            // because a tight one would miss real hits and a wide one costs only a few extra candidates.
            const queryMargin = Math.max(defaultTolerance, 100);
            const candidateIds = spatialIndexRef.current.queryPoint(rawX, rawY, queryMargin);

            // Topmost first, so overlapping elements pick what is drawn on top.
            for (const [elementId, element] of paintOrder.entriesFor(elements, candidateIds).reverse()) {
                if (acceptElement && !acceptElement(elementId, element)) continue;
                // Stored geometry is unrotated, so the point is turned into its frame.
                const { x, y } = worldPointToElement(element, { x: rawX, y: rawY });
                context.save();
                context.beginPath();
                const tolerance = toleranceFn ? toleranceFn(element) : defaultTolerance;

                if (element?.type === "path") {
                    if (!element.points || element.points.length < 2) {
                        context.restore();
                        continue;
                    }
                    context.lineWidth = tolerance;
                    context.moveTo(element.points[0].x, element.points[0].y);
                    for (let i = 1; i < element.points.length; i++) {
                        context.lineTo(element.points[i].x, element.points[i].y);
                    }
                    if (context.isPointInStroke(x, y) || (element.fillColor && context.isPointInPath(x, y))) {
                        context.restore();
                        return elementId;
                    }
                } else if (element?.type === "shape") {
                    context.lineWidth = tolerance;
                    traceShape(context, element);
                    const fillRule = element.shapeType === "Region" ? "evenodd" : "nonzero";
                    if (context.isPointInPath(x, y, fillRule) || context.isPointInStroke(x, y)) {
                        context.restore();
                        return elementId;
                    }
                } else if (
                    element?.type === "text" ||
                    element?.type === "sticky" ||
                    element?.type === "image" ||
                    element?.type === "embed" ||
                    element?.type === "frame" ||
                    element?.type === "table" ||
                    element?.type === "stamp"
                ) {
                    // No path to test, so the bounds are the target. A frame sits under its children, so it is hit last.
                    const bounds = getElementBounds(element);
                    context.restore();
                    if (bounds && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                        return elementId;
                    }
                    continue;
                } else if (element?.type === "connector") {
                    context.lineWidth = tolerance + (element.size || 2);
                    const polyline = resolveConnectorPolyline(element, elements);
                    traceConnectorPath(context, polyline);
                    if (context.isPointInStroke(x, y) || isOnConnectorLabel(context, element, polyline, x, y)) {
                        context.restore();
                        return elementId;
                    }
                }
                context.restore();
            }
            return null;
        },
        [elements, size, paintOrder, contextRef, spatialIndexRef],
    );

    const getSelectionTolerance = useCallback((element) => (element?.size || 1) + 8, []);

    // Every element under a point, largest first, however deep it's buried. A
    // path or arrow counts only when the point is on its line.
    const getElementStackAtPoint = useCallback(
        (rawX, rawY) => {
            const accepted = new Set();
            const stack = [];
            const nextBeneath = () => getElementAtPoint(rawX, rawY, getSelectionTolerance, (id) => !accepted.has(id));
            for (let id = nextBeneath(); id; id = nextBeneath()) {
                accepted.add(id);
                stack.push(id);
            }
            const areaOf = (id) => {
                const bounds = getElementBounds(elements[id]);
                return bounds ? (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) : 0;
            };
            return stack.sort((a, b) => areaOf(b) - areaOf(a));
        },
        [elements, getElementAtPoint, getSelectionTolerance],
    );

    return {
        getCanvasCoordinates,
        getElementAtPoint,
        getElementStackAtPoint,
        getSelectionTolerance,
    };
};
