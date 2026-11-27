import { clampZoom, viewportWorldBounds, worldToScreen } from "./camera";

// A camera that frames `bounds` with `padding` screen pixels around it, for zoom to fit and to selection.
// Static previews pass clamp: false, since a thumbnail shrinks a board past the interactive minimum zoom.
export const cameraToFit = (bounds, viewportWidth, viewportHeight, padding = 60, { clamp = true } = {}) => {
    if (!bounds) return null;
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const availableWidth = Math.max(1, viewportWidth - padding * 2);
    const availableHeight = Math.max(1, viewportHeight - padding * 2);
    const fitZoom = Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight);
    const zoom = clamp ? clampZoom(fitZoom) : fitZoom;

    const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
    const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
    return {
        x: boundsCenterX - viewportWidth / 2 / zoom,
        y: boundsCenterY - viewportHeight / 2 / zoom,
        zoom,
    };
};

// What is in view plus a `margin` of screen pixels, so nothing pops in late at the edge of a fast pan.
export const getVisibleElementIds = (spatialIndex, camera, viewportWidth, viewportHeight, margin = 200) => {
    const bounds = viewportWorldBounds(camera, viewportWidth, viewportHeight, margin);
    return spatialIndex.queryRect(bounds);
};

// For each target fully off screen: a point on the view's edge toward it, and the angle an arrow turns to.
export const getOffscreenIndicators = (targets, camera, viewportWidth, viewportHeight, edgeMargin = 24) => {
    const visible = viewportWorldBounds(camera, viewportWidth, viewportHeight);
    const centerScreenX = viewportWidth / 2;
    const centerScreenY = viewportHeight / 2;

    return targets
        .filter(({ bounds }) => {
            if (!bounds) return false;
            return bounds.maxX < visible.minX || bounds.minX > visible.maxX || bounds.maxY < visible.minY || bounds.minY > visible.maxY;
        })
        .map(({ id, bounds }) => {
            const targetCenterWorldX = (bounds.minX + bounds.maxX) / 2;
            const targetCenterWorldY = (bounds.minY + bounds.maxY) / 2;
            const targetScreen = worldToScreen(camera, targetCenterWorldX, targetCenterWorldY);

            const dx = targetScreen.x - centerScreenX;
            const dy = targetScreen.y - centerScreenY;
            const angle = Math.atan2(dy, dx);

            const halfWidth = viewportWidth / 2 - edgeMargin;
            const halfHeight = viewportHeight / 2 - edgeMargin;
            // Whichever axis reaches the inset edge first sets the scale.
            const scaleX = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity;
            const scaleY = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity;
            const scale = Math.min(scaleX, scaleY, 1);

            return {
                id,
                x: centerScreenX + dx * scale,
                y: centerScreenY + dy * scale,
                angle,
                worldX: targetCenterWorldX,
                worldY: targetCenterWorldY,
                bounds,
            };
        });
};
