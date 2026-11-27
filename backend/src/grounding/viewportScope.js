// Relations are quadratic in object count, so a board past GROUNDING_SIZE_THRESHOLD is grounded only near the viewport.
import { boundsIntersect, getElementBounds } from "../../../shared/canvas/geometry/bounds.js";

export const GROUNDING_SIZE_THRESHOLD = 1500;

// A wide margin, so relations don't flicker as the viewport pans.
const VIEWPORT_PADDING_PX = 800;

const padViewport = (viewport) => ({
    minX: viewport.minX - VIEWPORT_PADDING_PX,
    minY: viewport.minY - VIEWPORT_PADDING_PX,
    maxX: viewport.maxX + VIEWPORT_PADDING_PX,
    maxY: viewport.maxY + VIEWPORT_PADDING_PX,
});

export const shouldScopeToViewport = (elements, viewport) => Boolean(viewport) && Object.keys(elements).length > GROUNDING_SIZE_THRESHOLD;

// Returns elements unchanged when scoping doesn't apply.
export const scopeElementsToViewport = (elements, viewport) => {
    if (!shouldScopeToViewport(elements, viewport)) {
        return { elements, partial: false };
    }

    const padded = padViewport(viewport);
    const scoped = {};
    for (const [elementId, element] of Object.entries(elements)) {
        const bounds = getElementBounds(element);
        if (!bounds || boundsIntersect(bounds, padded)) scoped[elementId] = element;
    }

    // A viewport wide enough to take in most of the board gains nothing, and the whole scene is cached.
    if (Object.keys(scoped).length > GROUNDING_SIZE_THRESHOLD) return { elements, partial: false };
    return { elements: scoped, partial: true };
};
