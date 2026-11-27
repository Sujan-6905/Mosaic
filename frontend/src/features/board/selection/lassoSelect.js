// Pure freeform-selection math, extracted the same way zOrder.js and
// elementGeometry.js are: no React/DOM dependency, unit tested directly.

import { elementOutlineWorld } from "../../../../../shared/canvas/elements/connectors";
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";

// Ray casting: an odd number of crossings means inside. The polygon closes back to its first point.
export const pointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const straddlesY = a.y > point.y !== b.y > point.y;
        if (!straddlesY) continue;
        const crossingX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (point.x < crossingX) inside = !inside;
    }
    return inside;
};

// Points along what an element actually covers, so a lasso judges its real shape
// rather than just its middle.
const samplePointsOf = (element) => {
    if (element.type === "path" && element.points?.length) {
        const step = Math.max(1, Math.floor(element.points.length / 24));
        return element.points.filter((_, index) => index % step === 0);
    }
    if (element.type === "connector") {
        const points = [{ x: element.startX, y: element.startY }, ...(element.waypoints || []), { x: element.endX, y: element.endY }];
        return points;
    }
    const outline = elementOutlineWorld(element);
    if (outline) return outline.filter((_, index) => index % Math.max(1, Math.floor(outline.length / 24)) === 0);
    const bounds = getElementBounds(element);
    return bounds ? [{ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }] : [];
};

const ENCLOSED_SHARE = 0.6;

// An element is lassoed once most of it sits inside the loop, which is what
// someone circling a few things means, with no fuss about a stray corner.
export const getElementsInLasso = (elementsMap, candidateIds, polygonPoints) => {
    if (polygonPoints.length < 3) return [];
    return candidateIds.filter((id) => {
        const points = samplePointsOf(elementsMap[id] ?? {});
        if (points.length === 0) return false;
        const inside = points.filter((point) => pointInPolygon(point, polygonPoints)).length;
        return inside / points.length >= ENCLOSED_SHARE;
    });
};
