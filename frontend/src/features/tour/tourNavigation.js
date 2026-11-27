// `isReachable(step)` is injected so tests can simulate a missing anchor without a DOM.

// Returns -1 once no remaining step can be shown, which ends the tour.
export const findNextVisibleStepIndex = (steps, fromIndex, isReachable) => {
    for (let i = fromIndex; i < steps.length; i++) {
        if (isReachable(steps[i])) return i;
    }
    return -1;
};

export const findPreviousVisibleStepIndex = (steps, fromIndex, isReachable) => {
    for (let i = fromIndex; i >= 0; i--) {
        if (isReachable(steps[i])) return i;
    }
    return -1;
};

const CALLOUT_GAP = 16;
const VIEWPORT_MARGIN = 16;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Beside the target if it fits below, above, left or right, in that order; a target too big for all of those
// keeps the callout over its corner furthest from the screen's middle.
export const placeCallout = (rect, callout, viewport) => {
    const fitX = (x) => clamp(x, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewport.width - callout.width - VIEWPORT_MARGIN));
    const fitY = (y) => clamp(y, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewport.height - callout.height - VIEWPORT_MARGIN));
    const centredX = fitX(rect.left + rect.width / 2 - callout.width / 2);
    const centredY = fitY(rect.top + rect.height / 2 - callout.height / 2);

    if (rect.bottom + CALLOUT_GAP + callout.height <= viewport.height - VIEWPORT_MARGIN) return { left: centredX, top: rect.bottom + CALLOUT_GAP };
    if (rect.top - CALLOUT_GAP - callout.height >= VIEWPORT_MARGIN) return { left: centredX, top: rect.top - CALLOUT_GAP - callout.height };
    if (rect.left - CALLOUT_GAP - callout.width >= VIEWPORT_MARGIN) return { left: rect.left - CALLOUT_GAP - callout.width, top: centredY };
    if (rect.right + CALLOUT_GAP + callout.width <= viewport.width - VIEWPORT_MARGIN) return { left: rect.right + CALLOUT_GAP, top: centredY };
    return { left: fitX(viewport.width - callout.width - VIEWPORT_MARGIN), top: fitY(viewport.height - callout.height - VIEWPORT_MARGIN) };
};
