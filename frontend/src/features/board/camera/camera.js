// A camera is { x, y, zoom }: the world point at the screen's top-left, and the scale (1 is 100%).
// It is applied as the canvas transform, which is what lets drawing cull to what's on screen.

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

// Bounds the camera, never elements, well inside the range where floating-point positions stay exact.
export const MAX_CAMERA_COORDINATE = 10_000_000;

export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const clampCoordinate = (value) => Math.min(MAX_CAMERA_COORDINATE, Math.max(-MAX_CAMERA_COORDINATE, value));

export const worldToScreen = (camera, worldX, worldY) => ({
    x: (worldX - camera.x) * camera.zoom,
    y: (worldY - camera.y) * camera.zoom,
});

export const screenToWorld = (camera, screenX, screenY) => ({
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y,
});

// Keeps the world point under the cursor in place while zooming.
export const zoomAtScreenPoint = (camera, screenX, screenY, newZoom) => {
    const zoom = clampZoom(newZoom);
    const worldBefore = screenToWorld(camera, screenX, screenY);
    return {
        x: clampCoordinate(worldBefore.x - screenX / zoom),
        y: clampCoordinate(worldBefore.y - screenY / zoom),
        zoom,
    };
};

// Screen-pixel deltas, divided by zoom so content follows the pointer at any zoom.
export const panByScreenDelta = (camera, dx, dy) => ({
    x: clampCoordinate(camera.x - dx / camera.zoom),
    y: clampCoordinate(camera.y - dy / camera.zoom),
    zoom: camera.zoom,
});

// The visible world rectangle, widened by `margin` screen pixels so culling draws just past the edges.
export const viewportWorldBounds = (camera, viewportWidth, viewportHeight, margin = 0) => {
    const topLeft = screenToWorld(camera, -margin, -margin);
    const bottomRight = screenToWorld(camera, viewportWidth + margin, viewportHeight + margin);
    return { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y };
};

// Frames an empty board around the origin for a new board's first paint.
export const defaultCamera = (viewportWidth, viewportHeight, defaultViewWidth, defaultViewHeight) => ({
    x: -(viewportWidth - defaultViewWidth) / 2,
    y: -(viewportHeight - defaultViewHeight) / 2,
    zoom: 1,
});
