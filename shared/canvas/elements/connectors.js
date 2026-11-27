// A connector stores real end coordinates like any element; a bound end is re-pinned
// to its target here whenever the target changes. The route is derived, never stored.

import { elementPointToWorld } from "../geometry/elementGeometry.js";
import { getElementBounds, boundsCenter } from "../geometry/bounds.js";
import { isClosedShape, shapeOutlinePoints } from "../geometry/shapeGeometry.js";

export const CONNECTOR_ROUTINGS = ["straight", "curved", "elbow"];
export const ARROWHEADS = [
    "none",
    "arrow",
    "triangle",
    "triangle_outline",
    "diamond",
    "diamond_outline",
    "dot",
    "circle_outline",
    "bar",
    "crowfoot_one",
    "crowfoot_many",
    "crowfoot_one_many",
];

const SAME_SHIFT_EPSILON = 0.5;
const CURVE_SAMPLES = 32;
const SPLINE_SAMPLES_PER_SPAN = 12;
const MIN_ELBOW_STUB = 24;

export const connectorHead = (connector, end) => {
    const explicit = end === "start" ? connector.startHead : connector.endHead;
    if (explicit) return explicit;
    return (end === "start" ? connector.arrowStart : connector.arrowEnd) ? "triangle" : "none";
};

// arrowStart and arrowEnd mirror the head choice for readers that only need on or off.
export const withConnectorHeads = (patch) => ({
    ...patch,
    ...(patch.startHead ? { arrowStart: patch.startHead !== "none" } : {}),
    ...(patch.endHead ? { arrowEnd: patch.endHead !== "none" } : {}),
});

const polylineLength = (points) => {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    return total;
};

export const pointAlongPolyline = (points, fraction) => {
    if (points.length === 0) return null;
    let remaining = polylineLength(points) * Math.min(1, Math.max(0, fraction));
    for (let i = 1; i < points.length; i += 1) {
        const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        if (remaining <= length && length > 0) {
            const t = remaining / length;
            return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
        }
        remaining -= length;
    }
    return points[points.length - 1];
};

// Where a connector's label sits: a fraction along its route plus a distance off
// to one side, so it stays put relative to the arrow when the arrow moves.
export const connectorLabelPoint = (connector, polyline) => {
    const t = connector.labelT ?? 0.5;
    const onLine = pointAlongPolyline(polyline, t);
    const offset = connector.labelOffset || 0;
    if (!offset || polyline.length < 2) return onLine;
    const after = pointAlongPolyline(polyline, Math.min(1, t + 0.01));
    const before = pointAlongPolyline(polyline, Math.max(0, t - 0.01));
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    return { x: onLine.x - ((after.y - before.y) / length) * offset, y: onLine.y + ((after.x - before.x) / length) * offset };
};

// The placement that puts a connector's label at `point`.
export const connectorLabelPlacementAt = (polyline, point) => {
    const { fraction, point: onLine } = nearestOnPolyline(polyline, point);
    const after = pointAlongPolyline(polyline, Math.min(1, fraction + 0.01));
    const before = pointAlongPolyline(polyline, Math.max(0, fraction - 0.01));
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const offset = ((point.y - onLine.y) * (after.x - before.x) - (point.x - onLine.x) * (after.y - before.y)) / length;
    return { labelT: fraction, labelOffset: offset };
};

// How far along a polyline the nearest point to `point` sits, as a fraction,
// with that nearest point and its distance.
export const nearestOnPolyline = (points, point) => {
    const total = polylineLength(points) || 1;
    let travelled = 0;
    let best = { fraction: 0, point: points[0], distance: Infinity };
    for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
        const candidate = { x: a.x + dx * t, y: a.y + dy * t };
        const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        if (distance < best.distance) {
            best = { fraction: (travelled + Math.sqrt(lengthSquared) * t) / total, point: candidate, distance };
        }
        travelled += Math.sqrt(lengthSquared);
    }
    return best;
};

// Where a stored anchor sits on its target right now. No anchor means the
// target's middle; a connector target reads a fraction along its own route.
export const anchorToWorld = (target, anchor, elements, visited = new Set()) => {
    if (target.type === "connector") {
        const route = resolveConnectorPolyline(target, elements, visited);
        return pointAlongPolyline(route, anchor?.t ?? 0.5);
    }
    const bounds = getElementBounds(target);
    if (!bounds) return null;
    const center = boundsCenter(bounds);
    if (!anchor || anchor.x == null) return elementPointToWorld(target, center);
    return elementPointToWorld(target, {
        x: bounds.minX + (bounds.maxX - bounds.minX) * anchor.x,
        y: bounds.minY + (bounds.maxY - bounds.minY) * anchor.y,
    });
};

// A bend written relative to the line between the two ends stays in the same
// relative place when those ends move, like a rubber band.
const remapWaypoints = (before, after) => {
    const fromX = before.endX - before.startX;
    const fromY = before.endY - before.startY;
    const toX = after.endX - after.startX;
    const toY = after.endY - after.startY;
    const fromLengthSquared = fromX * fromX + fromY * fromY;
    if (fromLengthSquared === 0) return before.waypoints;
    return before.waypoints.map(({ x, y }) => {
        const px = x - before.startX;
        const py = y - before.startY;
        const along = (px * fromX + py * fromY) / fromLengthSquared;
        const across = (py * fromX - px * fromY) / fromLengthSquared;
        return { x: after.startX + along * toX - across * toY, y: after.startY + along * toY + across * toX };
    });
};

// A generated route only holds while both ends move together; moving one end
// leaves its bends pointing at where that node used to be.
const carryGeneratedWaypoints = (before, after) => {
    const startDx = after.startX - before.startX;
    const startDy = after.startY - before.startY;
    const endDx = after.endX - before.endX;
    const endDy = after.endY - before.endY;
    if (Math.abs(startDx - endDx) > SAME_SHIFT_EPSILON || Math.abs(startDy - endDy) > SAME_SHIFT_EPSILON) return null;
    return before.waypoints.map((point) => ({ x: point.x + startDx, y: point.y + startDy }));
};

// The stored coordinates a connector should have against `elements`.
const patchForBoundEnds = (connector, elements) => {
    const patch = {};
    if (connector.startElementId && elements[connector.startElementId]) {
        const point = anchorToWorld(elements[connector.startElementId], connector.startAnchor, elements);
        if (point) Object.assign(patch, { startX: point.x, startY: point.y });
    }
    if (connector.endElementId && elements[connector.endElementId]) {
        const point = anchorToWorld(elements[connector.endElementId], connector.endAnchor, elements);
        if (point) Object.assign(patch, { endX: point.x, endY: point.y });
    }
    return patch;
};

// Connectors bound to `changedIds`, transitively, that need a patch, keyed by id.
export const getBoundConnectorUpdates = (elements, changedIds) => {
    if (changedIds.length === 0) return {};
    const dependents = new Map();
    const addDependent = (targetId, connectorId) => {
        if (!targetId) return;
        if (!dependents.has(targetId)) dependents.set(targetId, []);
        dependents.get(targetId).push(connectorId);
    };
    for (const id in elements) {
        const element = elements[id];
        if (element.type !== "connector") continue;
        addDependent(element.startElementId, id);
        addDependent(element.endElementId, id);
    }

    const updates = {};
    const working = { ...elements };
    const seen = new Set();
    const queue = [...changedIds];
    while (queue.length > 0) {
        const targetId = queue.shift();
        for (const connectorId of dependents.get(targetId) || []) {
            if (seen.has(connectorId)) continue;
            seen.add(connectorId);
            const connector = working[connectorId];
            const patch = patchForBoundEnds(connector, working);
            if (Object.keys(patch).length === 0) continue;
            if (connector.waypoints?.length) {
                const after = { ...connector, ...patch };
                patch.waypoints = connector.routing ? remapWaypoints(connector, after) : carryGeneratedWaypoints(connector, after);
            }
            updates[connectorId] = { ...connector, ...patch };
            working[connectorId] = updates[connectorId];
            queue.push(connectorId);
        }
    }
    return updates;
};

// The connectors that follow `ids` when they move, and the small map needed to
// recompute them cheaply on every frame of a drag without touching the board.
export const boundConnectorScope = (elements, ids) => {
    const moving = new Set(ids);
    const connectors = [];
    for (const id in elements) {
        if (elements[id].type === "connector" && (elements[id].startElementId || elements[id].endElementId)) connectors.push(id);
    }
    const reached = new Set();
    let grew = true;
    while (grew) {
        grew = false;
        for (const id of connectors) {
            if (reached.has(id) || moving.has(id)) continue;
            const { startElementId, endElementId } = elements[id];
            if (moving.has(startElementId) || moving.has(endElementId) || reached.has(startElementId) || reached.has(endElementId)) {
                reached.add(id);
                grew = true;
            }
        }
    }
    const scope = {};
    ids.forEach((id) => {
        if (elements[id]) scope[id] = elements[id];
    });
    reached.forEach((id) => {
        const connector = elements[id];
        scope[id] = connector;
        if (elements[connector.startElementId]) scope[connector.startElementId] = elements[connector.startElementId];
        if (elements[connector.endElementId]) scope[connector.endElementId] = elements[connector.endElementId];
    });
    return { connectorIds: [...reached], scope };
};

// Connectors bound to these elements (deleted, or shaken loose) let go of them,
// keeping their last known position rather than being deleted.
export const releaseConnectorsFrom = (elements, releasedIds) => {
    const deleted = new Set(releasedIds);
    const updates = {};
    Object.entries(elements).forEach(([id, element]) => {
        // A connector released along with them needs no update, which could bring a deleted one back.
        if (element.type !== "connector" || deleted.has(id)) return;
        if (!deleted.has(element.startElementId) && !deleted.has(element.endElementId)) return;
        updates[id] = {
            ...element,
            startElementId: deleted.has(element.startElementId) ? null : element.startElementId,
            endElementId: deleted.has(element.endElementId) ? null : element.endElementId,
            ...(deleted.has(element.startElementId) ? { startAnchor: null } : {}),
            ...(deleted.has(element.endElementId) ? { endAnchor: null } : {}),
        };
    });
    return updates;
};

// The polygon an arrow should stop at, in world space, or null for a target
// with no solid edge such as a line.
export const elementOutlineWorld = (element) => {
    if (!element) return null;
    if (element.type === "path" || element.type === "connector") return null;
    let points = isClosedShape(element) ? shapeOutlinePoints(element) : null;
    if (!points || points.length < 3) {
        const bounds = getElementBounds(element);
        if (!bounds) return null;
        points = [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY },
        ];
    }
    return element.rotation ? points.map((point) => elementPointToWorld(element, point)) : points;
};

const segmentCrossing = (a, b, c, d) => {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denominator = rX * sY - rY * sX;
    if (Math.abs(denominator) < 1e-9) return null;
    const t = ((c.x - a.x) * sY - (c.y - a.y) * sX) / denominator;
    const u = ((c.x - a.x) * rY - (c.y - a.y) * rX) / denominator;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
};

// Cuts a route so it starts where it first leaves `outline`, keeping everything
// after that crossing. A route that never crosses is returned whole.
const clipRouteStart = (points, outline) => {
    if (!outline || outline.length < 3) return points;
    for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        let furthest = null;
        for (let j = 0; j < outline.length; j += 1) {
            const t = segmentCrossing(a, b, outline[j], outline[(j + 1) % outline.length]);
            if (t !== null && (furthest === null || t > furthest)) furthest = t;
        }
        if (furthest !== null) {
            return [{ x: a.x + (b.x - a.x) * furthest, y: a.y + (b.y - a.y) * furthest }, ...points.slice(i)];
        }
    }
    return points;
};

const catmullRom = (points) => {
    const samples = [points[0]];
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        for (let step = 1; step <= SPLINE_SAMPLES_PER_SPAN; step += 1) {
            const t = step / SPLINE_SAMPLES_PER_SPAN;
            const t2 = t * t;
            const t3 = t2 * t;
            samples.push({
                x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
                y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
            });
        }
    }
    return samples;
};

// A gentle S between two free ends, leaving along whichever axis they're
// further apart on, the way a hand-drawn connector does.
const sCurve = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const reach = (horizontal ? Math.abs(dx) : Math.abs(dy)) * 0.5;
    const c1 = horizontal ? { x: start.x + Math.sign(dx) * reach, y: start.y } : { x: start.x, y: start.y + Math.sign(dy) * reach };
    const c2 = horizontal ? { x: end.x - Math.sign(dx) * reach, y: end.y } : { x: end.x, y: end.y - Math.sign(dy) * reach };
    const samples = [];
    for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
        const t = i / CURVE_SAMPLES;
        const mt = 1 - t;
        samples.push({
            x: mt ** 3 * start.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * end.x,
            y: mt ** 3 * start.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * end.y,
        });
    }
    return samples;
};

// The point on a target's box edge a square route leaves from: the middle of
// whichever side faces `toward`.
const boxExit = (bounds, toward) => {
    const center = boundsCenter(bounds);
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    const width = bounds.maxX - bounds.minX || 1;
    const height = bounds.maxY - bounds.minY || 1;
    if (Math.abs(dx) / width >= Math.abs(dy) / height) {
        return { x: dx >= 0 ? bounds.maxX : bounds.minX, y: center.y, axis: "x", direction: Math.sign(dx) || 1 };
    }
    return { x: center.x, y: dy >= 0 ? bounds.maxY : bounds.minY, axis: "y", direction: Math.sign(dy) || 1 };
};

const elbowRoute = (connector, startBounds, endBounds) => {
    const free = (x, y) => ({ x, y, axis: null, direction: 0 });
    const startTarget = { x: connector.endX, y: connector.endY };
    const endTarget = { x: connector.startX, y: connector.startY };
    const start = startBounds ? boxExit(startBounds, startTarget) : free(connector.startX, connector.startY);
    const end = endBounds ? boxExit(endBounds, endTarget) : free(connector.endX, connector.endY);
    const horizontal = start.axis ? start.axis === "x" : end.axis ? end.axis === "x" : Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    const bias = connector.elbowBias ?? 0.5;
    if (horizontal) {
        let midX = start.x + (end.x - start.x) * bias;
        if (start.axis === "x" && (midX - start.x) * start.direction < MIN_ELBOW_STUB) midX = start.x + start.direction * MIN_ELBOW_STUB;
        if (end.axis === "y") return [start, { x: end.x, y: start.y }, end];
        return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
    }
    let midY = start.y + (end.y - start.y) * bias;
    if (start.axis === "y" && (midY - start.y) * start.direction < MIN_ELBOW_STUB) midY = start.y + start.direction * MIN_ELBOW_STUB;
    if (end.axis === "x") return [start, { x: start.x, y: end.y }, end];
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
};

// The drawn route as points, curves already sampled, each bound end cut back to
// its target's real outline rather than floating at its middle or its box.
export function resolveConnectorPolyline(connector, elements, visited = new Set()) {
    if (visited.has(connector))
        return [
            { x: connector.startX, y: connector.startY },
            { x: connector.endX, y: connector.endY },
        ];
    visited.add(connector);
    const startTarget = connector.startElementId ? elements[connector.startElementId] : null;
    const endTarget = connector.endElementId ? elements[connector.endElementId] : null;
    const waypoints = (connector.waypoints || []).map(({ x, y }) => ({ x, y }));
    const start = { x: connector.startX, y: connector.startY };
    const end = { x: connector.endX, y: connector.endY };

    if (connector.routing === "elbow") {
        const boxOf = (target) => (target && target.type !== "connector" ? getElementBounds(target) : null);
        return elbowRoute(connector, boxOf(startTarget), boxOf(endTarget)).map(({ x, y }) => ({ x, y }));
    }

    let route;
    if (connector.routing === "curved") {
        route = waypoints.length > 0 ? catmullRom([start, ...waypoints, end]) : sCurve(start, end);
    } else {
        route = [start, ...waypoints, end];
    }
    const startOutline = elementOutlineWorld(startTarget);
    if (startOutline) route = clipRouteStart(route, startOutline);
    const endOutline = elementOutlineWorld(endTarget);
    if (endOutline) route = clipRouteStart([...route].reverse(), endOutline).reverse();
    return route;
}

// Removes `startTrim` and `endTrim` world units from the ends of a route, so a
// thick line doesn't poke through the tip of its arrowhead.
export const trimPolyline = (points, startTrim, endTrim) => {
    const trimEnd = (input, amount) => {
        const output = [...input];
        let remaining = amount;
        while (output.length > 1 && remaining > 0) {
            const last = output[output.length - 1];
            const previous = output[output.length - 2];
            const length = Math.hypot(last.x - previous.x, last.y - previous.y);
            if (length > remaining) {
                const t = (length - remaining) / length;
                output[output.length - 1] = { x: previous.x + (last.x - previous.x) * t, y: previous.y + (last.y - previous.y) * t };
                return output;
            }
            remaining -= length;
            output.pop();
        }
        return output;
    };
    const trimmed = trimEnd(points, endTrim);
    return trimEnd([...trimmed].reverse(), startTrim).reverse();
};
