import { getElementBounds } from "../geometry/bounds.js";

const isFullyContained = (innerBounds, outerBounds) =>
    innerBounds.minX >= outerBounds.minX &&
    innerBounds.minY >= outerBounds.minY &&
    innerBounds.maxX <= outerBounds.maxX &&
    innerBounds.maxY <= outerBounds.maxY;

// The topmost frame (by zIndex) that fully contains the element, or null.
export const findContainingFrame = (elements, elementBounds) => {
    let winner = null;
    for (const [frameId, frame] of Object.entries(elements)) {
        if (frame.type !== "frame") continue;
        const frameBounds = getElementBounds(frame);
        if (!frameBounds || !isFullyContained(elementBounds, frameBounds)) continue;
        if (!winner || (frame.zIndex ?? 0) > (winner.zIndex ?? 0)) {
            winner = { frameId, zIndex: frame.zIndex ?? 0 };
        }
    }
    return winner?.frameId ?? null;
};

// Re-derives frameId for moved elements from their new positions. Frames never
// join another frame: membership is flat.
export const applyFrameMembership = (elements, updatedById) => {
    const withMembership = {};
    Object.entries(updatedById).forEach(([id, element]) => {
        if (element.type === "frame") {
            withMembership[id] = element;
            return;
        }
        const bounds = getElementBounds(element);
        const frameId = bounds ? findContainingFrame(elements, bounds) : null;
        withMembership[id] = frameId === element.frameId ? element : { ...element, frameId };
    });
    return withMembership;
};

// Adds each dragged frame's children to the drag set (never to the visible selection).
export const expandWithFrameChildren = (elements, ids) => {
    const frameIds = new Set(ids.filter((id) => elements[id]?.type === "frame"));
    if (frameIds.size === 0) return ids;
    const childIds = Object.entries(elements)
        .filter(([id, element]) => element.frameId && frameIds.has(element.frameId) && !ids.includes(id))
        .map(([id]) => id);
    return childIds.length === 0 ? ids : [...ids, ...childIds];
};
