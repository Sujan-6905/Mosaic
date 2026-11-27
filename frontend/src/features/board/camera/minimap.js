// The scale and offset that centre `contentBounds` in the minimap with `padding`; null with no content.
export const computeMinimapProjection = (contentBounds, minimapWidth, minimapHeight, padding = 8) => {
    if (!contentBounds) return null;
    const contentWidth = Math.max(1, contentBounds.maxX - contentBounds.minX);
    const contentHeight = Math.max(1, contentBounds.maxY - contentBounds.minY);
    const availableWidth = Math.max(1, minimapWidth - padding * 2);
    const availableHeight = Math.max(1, minimapHeight - padding * 2);
    const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

    return {
        scale,
        offsetX: padding + (availableWidth - contentWidth * scale) / 2 - contentBounds.minX * scale,
        offsetY: padding + (availableHeight - contentHeight * scale) / 2 - contentBounds.minY * scale,
    };
};

export const projectWorldToMinimap = (projection, worldX, worldY) => ({
    x: worldX * projection.scale + projection.offsetX,
    y: worldY * projection.scale + projection.offsetY,
});

export const projectMinimapToWorld = (projection, minimapX, minimapY) => ({
    x: (minimapX - projection.offsetX) / projection.scale,
    y: (minimapY - projection.offsetY) / projection.scale,
});
