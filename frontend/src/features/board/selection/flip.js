import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";

// Mirrors the selection across its own middle: shapes turn over, text only moves, arrows follow their anchors.
const mirror = (value, middle) => 2 * middle - value;

const flipAnchor = (anchor, axis) => {
    if (!anchor || anchor.t !== undefined) return anchor;
    return axis === "x" ? { ...anchor, x: 1 - anchor.x } : { ...anchor, y: 1 - anchor.y };
};

const flipOne = (element, axis, middle) => {
    const flipX = axis === "x";
    const point = (p) => (flipX ? { ...p, x: mirror(p.x, middle) } : { ...p, y: mirror(p.y, middle) });
    const rotation = element.rotation ? -element.rotation : element.rotation;
    if (element.type === "path") return { ...element, points: element.points.map(point), rotation };
    if (element.type === "text" || element.type === "sticky") {
        const width = element.type === "sticky" ? element.width : element.width || 0;
        return flipX ? { ...element, x: mirror(element.x + width, middle) } : { ...element, y: mirror(element.y + (element.height || 0), middle) };
    }
    if (element.type === "connector") {
        const start = point({ x: element.startX, y: element.startY });
        const end = point({ x: element.endX, y: element.endY });
        return {
            ...element,
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            waypoints: element.waypoints?.map(point) ?? element.waypoints,
            startAnchor: flipAnchor(element.startAnchor, axis),
            endAnchor: flipAnchor(element.endAnchor, axis),
            ...(element.labelOffset ? { labelOffset: -element.labelOffset } : {}),
        };
    }
    if (element.startX === undefined) return element;
    const start = point({ x: element.startX, y: element.startY });
    const end = point({ x: element.endX, y: element.endY });
    const keepsUpright =
        element.type === "frame" || element.type === "image" || element.type === "embed" || element.type === "table" || element.type === "stamp";
    if (keepsUpright) {
        return {
            ...element,
            startX: Math.min(start.x, end.x),
            startY: Math.min(start.y, end.y),
            endX: Math.max(start.x, end.x),
            endY: Math.max(start.y, end.y),
        };
    }
    return { ...element, startX: start.x, startY: start.y, endX: end.x, endY: end.y, rotation };
};

export const flipElements = (elements, ids, axis) => {
    const chosen = ids.map((id) => elements[id]).filter(Boolean);
    const bounds = getUnionBounds(chosen);
    if (!bounds) return {};
    const middle = axis === "x" ? (bounds.minX + bounds.maxX) / 2 : (bounds.minY + bounds.maxY) / 2;
    return Object.fromEntries(ids.filter((id) => elements[id]).map((id) => [id, flipOne(elements[id], axis, middle)]));
};
