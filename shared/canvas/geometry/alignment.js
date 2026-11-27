import { translateElement } from "./elementGeometry.js";
import { getElementBounds, getUnionBounds } from "./bounds.js";

// Every element's left, centre and right (and top, middle, bottom) edges.
export const getSnapLines = (elementsList) => {
    const xs = [];
    const ys = [];
    elementsList.forEach((element) => {
        const bounds = getElementBounds(element);
        if (!bounds) return;
        xs.push(bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX);
        ys.push(bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY);
    });
    return { xs, ys };
};

// The smallest per-axis shift, within `threshold`, that lines one of `bounds`'s edges up
// with a snap line; `snappedX`/`snappedY` say where to draw the guide.
export const computeSnapAdjustment = (bounds, snapLines, threshold) => {
    const closest = (edges, candidates) => {
        let best = null;
        edges.forEach((edge) => {
            candidates.forEach((candidate) => {
                const distance = Math.abs(candidate - edge);
                if (distance <= threshold && (!best || distance < best.distance)) {
                    best = { distance, delta: candidate - edge, line: candidate };
                }
            });
        });
        return best;
    };

    const bestX = closest([bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX], snapLines.xs);
    const bestY = closest([bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY], snapLines.ys);

    return {
        dx: bestX?.delta ?? 0,
        dy: bestY?.delta ?? 0,
        snappedX: bestX?.line ?? null,
        snappedY: bestY?.line ?? null,
    };
};

// Moves each element so the given edge lands on that edge of the selection's union bounds.
const alignAxis = (elementsMap, ids, axis, edgeOf, targetEdgeOf) => {
    if (ids.length < 2) return {};
    const unionBounds = getUnionBounds(ids.map((id) => elementsMap[id]).filter(Boolean));
    if (!unionBounds) return {};
    const target = targetEdgeOf(unionBounds);

    const updatedById = {};
    ids.forEach((id) => {
        const element = elementsMap[id];
        const bounds = getElementBounds(element);
        if (!bounds) return;
        const delta = target - edgeOf(bounds);
        if (Math.abs(delta) < 1e-9) return;
        updatedById[id] = axis === "x" ? translateElement(element, delta, 0) : translateElement(element, 0, delta);
    });
    return updatedById;
};

export const alignLeft = (elementsMap, ids) =>
    alignAxis(
        elementsMap,
        ids,
        "x",
        (b) => b.minX,
        (u) => u.minX,
    );
export const alignHCenter = (elementsMap, ids) =>
    alignAxis(
        elementsMap,
        ids,
        "x",
        (b) => (b.minX + b.maxX) / 2,
        (u) => (u.minX + u.maxX) / 2,
    );
export const alignRight = (elementsMap, ids) =>
    alignAxis(
        elementsMap,
        ids,
        "x",
        (b) => b.maxX,
        (u) => u.maxX,
    );
export const alignTop = (elementsMap, ids) =>
    alignAxis(
        elementsMap,
        ids,
        "y",
        (b) => b.minY,
        (u) => u.minY,
    );
export const alignVCenter = (elementsMap, ids) =>
    alignAxis(
        elementsMap,
        ids,
        "y",
        (b) => (b.minY + b.maxY) / 2,
        (u) => (u.minY + u.maxY) / 2,
    );
export const alignBottom = (elementsMap, ids) =>
    alignAxis(
        elementsMap,
        ids,
        "y",
        (b) => b.maxY,
        (u) => u.maxY,
    );

// Evenly spaces the gaps between bounds along one axis, keeping the two outermost
// elements fixed; needs three or more elements.
const distributeAxis = (elementsMap, ids, axis, minOf, maxOf) => {
    const withBounds = ids.map((id) => ({ id, element: elementsMap[id], bounds: getElementBounds(elementsMap[id]) })).filter((entry) => entry.bounds);
    if (withBounds.length < 3) return {};
    withBounds.sort((a, b) => minOf(a.bounds) - minOf(b.bounds));

    const first = withBounds[0];
    const last = withBounds[withBounds.length - 1];
    const totalSpan = maxOf(last.bounds) - minOf(first.bounds);
    const totalSize = withBounds.reduce((sum, entry) => sum + (maxOf(entry.bounds) - minOf(entry.bounds)), 0);
    const gap = (totalSpan - totalSize) / (withBounds.length - 1);

    const updatedById = {};
    let cursor = minOf(first.bounds);
    withBounds.forEach((entry, i) => {
        const size = maxOf(entry.bounds) - minOf(entry.bounds);
        if (i > 0 && i < withBounds.length - 1) {
            const delta = cursor - minOf(entry.bounds);
            if (Math.abs(delta) > 1e-9) {
                updatedById[entry.id] = axis === "x" ? translateElement(entry.element, delta, 0) : translateElement(entry.element, 0, delta);
            }
        }
        cursor += size + gap;
    });
    return updatedById;
};

export const distributeHorizontal = (elementsMap, ids) =>
    distributeAxis(
        elementsMap,
        ids,
        "x",
        (b) => b.minX,
        (b) => b.maxX,
    );
export const distributeVertical = (elementsMap, ids) =>
    distributeAxis(
        elementsMap,
        ids,
        "y",
        (b) => b.minY,
        (b) => b.maxY,
    );
