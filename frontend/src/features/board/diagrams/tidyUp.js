// Re-lays a selection out with the assistant's layout engine, locally and instantly.
// Only positions change; sizes and every other field stay.

import { boundsCenter, getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { computeLayout } from "./layoutEngine";

const isNodeType = (type) => type === "shape" || type === "text" || type === "sticky";

export const deriveGraphFromSelection = (elements, selectedIds) => {
    const nodeIds = selectedIds.filter((id) => isNodeType(elements[id]?.type));
    const nodeIdSet = new Set(nodeIds);

    const nodes = nodeIds.map((id) => {
        const bounds = getElementBounds(elements[id]);
        return { id, label: elements[id].text || elements[id].shapeType || "", w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY };
    });

    const edges = selectedIds
        .map((id) => elements[id])
        .filter((element) => element?.type === "connector" && nodeIdSet.has(element.startElementId) && nodeIdSet.has(element.endElementId))
        .map((connector) => ({ from: connector.startElementId, to: connector.endElementId }));

    return { nodeIds, nodes, edges };
};

// New positions for the selection's nodes, centred where the selection already was.
export const buildTidyPositionUpdates = (elements, selectedIds, direction) => {
    const { nodeIds, nodes, edges } = deriveGraphFromSelection(elements, selectedIds);
    if (nodes.length === 0) return {};

    const positions = computeLayout(nodes, edges, direction);

    const currentCenters = nodeIds.map((id) => boundsCenter(getElementBounds(elements[id])));
    const originalCenterX = currentCenters.reduce((sum, c) => sum + c.x, 0) / currentCenters.length;
    const originalCenterY = currentCenters.reduce((sum, c) => sum + c.y, 0) / currentCenters.length;

    const placed = Object.values(positions);
    const layoutMinX = Math.min(...placed.map((p) => p.cx - p.w / 2));
    const layoutMaxX = Math.max(...placed.map((p) => p.cx + p.w / 2));
    const layoutMinY = Math.min(...placed.map((p) => p.cy - p.h / 2));
    const layoutMaxY = Math.max(...placed.map((p) => p.cy + p.h / 2));
    const offsetX = originalCenterX - (layoutMinX + layoutMaxX) / 2;
    const offsetY = originalCenterY - (layoutMinY + layoutMaxY) / 2;

    const updates = {};
    nodeIds.forEach((id) => {
        const element = elements[id];
        const { cx, cy, w, h } = positions[id];
        const centerX = cx + offsetX;
        const centerY = cy + offsetY;

        if (element.type === "shape") {
            updates[id] = {
                ...element,
                startX: centerX - w / 2,
                startY: centerY - h / 2,
                endX: centerX + w / 2,
                endY: centerY + h / 2,
            };
        } else {
            updates[id] = { ...element, x: centerX - w / 2, y: centerY - h / 2 };
        }
    });
    return updates;
};
