import { rotateElementAroundPivot, scaleElementAboutAnchor, translateElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getUnionBounds, boundsCenter } from "../../../../../shared/canvas/geometry/bounds.js";
import { elementIdsForRefs } from "./common.js";

// About the middle of everything named, so a thing grows in place and its parts
// keep their arrangement. Text grows with its box, or "bigger" would only rewrap it.
const executeResize = (elements, groupIndex, op) => {
    const memberIds = elementIdsForRefs(groupIndex, op.refs);
    const bounds = getUnionBounds(memberIds.map((id) => elements[id]).filter(Boolean));
    if (!bounds) return { error: "nothing to resize" };
    const centre = boundsCenter(bounds);
    const updatedById = {};
    memberIds.forEach((id) => {
        const element = elements[id];
        const scaled = scaleElementAboutAnchor(element, centre.x, centre.y, op.factor, op.factor);
        updatedById[id] = element.type === "text" ? { ...scaled, size: element.size * op.factor } : scaled;
    });
    return { updatedById };
};

const MOVE_DISTANCE_SHARE = { small: 0.25, medium: 0.6, large: 1.2 };
const MOVE_DISTANCE_MIN_PX = { small: 40, medium: 120, large: 300 };
const MOVE_AXIS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };

// Named in steps relative to the thing itself, so a model never picks a coordinate.
const executeMove = (elements, groupIndex, op) => {
    const memberIds = elementIdsForRefs(groupIndex, op.refs);
    const bounds = getUnionBounds(memberIds.map((id) => elements[id]).filter(Boolean));
    if (!bounds) return { error: "nothing to move" };
    const axis = MOVE_AXIS[op.direction];
    const extent = axis.x !== 0 ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY;
    const distance = Math.max(extent * MOVE_DISTANCE_SHARE[op.distance], MOVE_DISTANCE_MIN_PX[op.distance]);
    const updatedById = {};
    memberIds.forEach((id) => {
        updatedById[id] = translateElement(elements[id], axis.x * distance, axis.y * distance);
    });
    return { updatedById };
};

const executeRotate = (elements, groupIndex, op) => {
    const memberIds = elementIdsForRefs(groupIndex, op.refs);
    const bounds = getUnionBounds(memberIds.map((id) => elements[id]).filter(Boolean));
    if (!bounds) return { error: "nothing to rotate" };
    const centre = boundsCenter(bounds);
    const updatedById = {};
    memberIds.forEach((id) => {
        updatedById[id] = rotateElementAroundPivot(elements[id], centre.x, centre.y, op.degrees);
    });
    return { updatedById };
};

export const TRANSFORM_EXECUTORS = { resize: executeResize, move: executeMove, rotate: executeRotate };
