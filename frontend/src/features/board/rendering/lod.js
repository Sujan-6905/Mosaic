// Level of detail keeps a dense board fast when zoomed out. Tests pin these thresholds.

// Below this rendered glyph height (screen px), text is unreadable anyway -
// renderText swaps to a placeholder bar instead of paying for fillText.
export const MIN_LEGIBLE_TEXT_PX = 6;

// Below this on-screen size the eight resize handles would swamp the element, so they are hidden.
export const MIN_HANDLE_PROJECTION_PX = 16;

// Below this zoom a stroke has more points than the screen can show, so it is simplified first.
export const SIMPLIFY_ZOOM_THRESHOLD = 0.5;

// About one screen pixel of tolerance, snapped to powers of two so a zoom
// animation reuses a few cached outlines instead of building one per frame.
export const simplifyToleranceFor = (zoom) => (zoom < SIMPLIFY_ZOOM_THRESHOLD ? 2 ** Math.floor(Math.log2(1 / zoom)) : null);

// Above this many visible elements, shapes skip the fill pass for interiors too small to read.
export const HIDE_FINE_DETAIL_ELEMENT_COUNT = 1500;

// An element this small on screen is at most a couple of pixels, so a filled
// rectangle looks identical and skips building and filling its real path.
const SPECK_SCREEN_PX = 2;

export const isSpeck = (bounds, zoom) => (bounds.maxX - bounds.minX) * zoom <= SPECK_SCREEN_PX && (bounds.maxY - bounds.minY) * zoom <= SPECK_SCREEN_PX;

// Below this on-screen width a sticky's soft shadow can't be seen, and a canvas
// blur is by far the most expensive thing it draws.
export const MIN_STICKY_SHADOW_PX = 48;

export const getLodLevel = (zoom, visibleElementCount) => ({
    simplifyTolerance: simplifyToleranceFor(zoom),
    hideFineDetail: visibleElementCount > HIDE_FINE_DETAIL_ELEMENT_COUNT,
});

export const isTextLegible = (element, zoom) => (element.size || 16) * zoom >= MIN_LEGIBLE_TEXT_PX;

export const shouldHideHandles = (screenBounds) =>
    screenBounds.maxX - screenBounds.minX < MIN_HANDLE_PROJECTION_PX || screenBounds.maxY - screenBounds.minY < MIN_HANDLE_PROJECTION_PX;

// Ramer-Douglas-Peucker: drops points within `tolerance` of the line between neighbours, keeping whole points.
const perpendicularDistance = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
};

export const simplifyPathPoints = (points, tolerance) => {
    if (!points || points.length < 3) return points;

    let maxDistance = 0;
    let splitIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
        const distance = perpendicularDistance(points[i], start, end);
        if (distance > maxDistance) {
            maxDistance = distance;
            splitIndex = i;
        }
    }

    if (maxDistance <= tolerance) return [start, end];

    const left = simplifyPathPoints(points.slice(0, splitIndex + 1), tolerance);
    const right = simplifyPathPoints(points.slice(splitIndex), tolerance);
    return [...left.slice(0, -1), ...right];
};
