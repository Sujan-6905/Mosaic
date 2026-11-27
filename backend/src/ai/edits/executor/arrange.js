import { translateElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { getElementBounds, getUnionBounds, boundsCenter } from "../../../../../shared/canvas/geometry/bounds.js";
import {
    alignLeft,
    alignHCenter,
    alignRight,
    alignTop,
    alignVCenter,
    alignBottom,
    distributeHorizontal,
    distributeVertical,
} from "../../../../../shared/canvas/geometry/alignment.js";
import { bringToFront, sendToBack, bringForward, sendBackward } from "../../../../../shared/canvas/editing/zOrder.js";
import { computeSimpleLayout } from "./simpleLayout.js";
import { boundsOf, gapFor, placementDelta } from "./common.js";

// A group's bounds as a plain rectangle, so the per-element alignment math applies to whole groups.
const pseudoShape = (bounds) => ({ type: "shape", shapeType: "rectangle", startX: bounds.minX, startY: bounds.minY, endX: bounds.maxX, endY: bounds.maxY });

// Aligns one stand-in per ref, then moves every member of that ref by its stand-in's offset.
const rigidly = (elements, groupIndex, refs, alignOrDistributeFn) => {
    const pseudoElements = {};
    refs.forEach((ref) => {
        const bounds = boundsOf(elements, groupIndex, ref);
        if (bounds) pseudoElements[ref] = pseudoShape(bounds);
    });

    const pseudoUpdates = alignOrDistributeFn(pseudoElements, Object.keys(pseudoElements));
    const updatedById = {};
    Object.entries(pseudoUpdates).forEach(([ref, updatedPseudo]) => {
        const originalBounds = getElementBounds(pseudoElements[ref]);
        const newBounds = getElementBounds(updatedPseudo);
        const dx = newBounds.minX - originalBounds.minX;
        const dy = newBounds.minY - originalBounds.minY;
        if (dx === 0 && dy === 0) return;
        groupIndex.elementIdsForRef(ref).forEach((id) => {
            updatedById[id] = translateElement(elements[id], dx, dy);
        });
    });
    return updatedById;
};

// A lone group has nothing to line up against, so align, distribute or tidy act on its members
// ("align the cluster"); a labelled shape or connector stays whole.
const spreadSoleGroup = (elements, groupIndex, refs) => {
    if (refs.length !== 1) return refs;
    const memberIds = groupIndex.elementIdsForRef(refs[0]);
    const spreadable = memberIds.length >= 2 && memberIds.every((id) => elements[id] && elements[id].type !== "text");
    return spreadable ? memberIds : refs;
};

const ALIGN_FNS = { left: alignLeft, "h-center": alignHCenter, right: alignRight, top: alignTop, "v-center": alignVCenter, bottom: alignBottom };

const executeAlign = (elements, groupIndex, op) => ({
    updatedById: rigidly(elements, groupIndex, spreadSoleGroup(elements, groupIndex, op.refs), ALIGN_FNS[op.edge]),
});

const DISTRIBUTE_FNS = { horizontal: distributeHorizontal, vertical: distributeVertical };

const executeDistribute = (elements, groupIndex, op) => {
    const refs = spreadSoleGroup(elements, groupIndex, op.refs);
    if (refs.length < 3) return { error: "distribute needs at least 3 refs" };
    return { updatedById: rigidly(elements, groupIndex, refs, DISTRIBUTE_FNS[op.axis]) };
};

const executePlace = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    const anchorIds = groupIndex.elementIdsForRef(op.anchorRef);
    if (memberIds.length === 0) return { error: `unknown ref: ${op.ref}` };
    if (anchorIds.length === 0) return { error: `unknown anchorRef: ${op.anchorRef}` };

    const objectBounds = boundsOf(elements, groupIndex, op.ref);
    const anchorBounds = boundsOf(elements, groupIndex, op.anchorRef);
    if (!objectBounds || !anchorBounds) return { error: "could not compute bounds for place" };

    const { dx, dy } = placementDelta(objectBounds, anchorBounds, op.relation, op.gap ?? gapFor(op.relation));

    const updatedById = {};
    memberIds.forEach((id) => {
        updatedById[id] = translateElement(elements[id], dx, dy);
    });
    return { updatedById };
};

const FRAME_FIT_PADDING_PX = 24;

// Only a frame has an unambiguous "fit to what": its own children.
const executeResizeToFit = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    if (memberIds.length !== 1 || elements[memberIds[0]]?.type !== "frame") {
        return { error: "resizeToFit only supports a single frame" };
    }
    const [frameId] = memberIds;
    const frame = elements[frameId];
    const children = Object.values(elements).filter((candidate) => candidate.frameId === frameId);
    const childBounds = getUnionBounds(children);
    if (!childBounds) return { updatedById: {} };

    return {
        updatedById: {
            [frameId]: {
                ...frame,
                startX: childBounds.minX - FRAME_FIT_PADDING_PX,
                startY: childBounds.minY - FRAME_FIT_PADDING_PX,
                endX: childBounds.maxX + FRAME_FIT_PADDING_PX,
                endY: childBounds.maxY + FRAME_FIT_PADDING_PX,
            },
        },
    };
};

const REORDER_FNS = { front: bringToFront, back: sendToBack, forward: bringForward, backward: sendBackward };

const executeReorder = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    if (memberIds.length === 0) return { error: `unknown ref: ${op.ref}` };
    const zIndexUpdates = REORDER_FNS[op.direction](elements, memberIds);
    const updatedById = {};
    Object.entries(zIndexUpdates).forEach(([id, zIndex]) => {
        updatedById[id] = { ...elements[id], zIndex };
    });
    return { updatedById };
};

const executeMoveToFrame = (elements, groupIndex, op) => {
    const memberIds = groupIndex.elementIdsForRef(op.ref);
    if (memberIds.length === 0) return { error: `unknown ref: ${op.ref}` };

    let frameElementId = null;
    if (op.frameRef !== null) {
        const frameMemberIds = groupIndex.elementIdsForRef(op.frameRef);
        if (frameMemberIds.length !== 1 || elements[frameMemberIds[0]]?.type !== "frame") {
            return { error: `frameRef ${op.frameRef} does not resolve to a single frame` };
        }
        frameElementId = frameMemberIds[0];
    }

    const updatedById = {};
    memberIds.forEach((id) => {
        if (elements[id]) updatedById[id] = { ...elements[id], frameId: frameElementId };
    });
    return { updatedById };
};

const executeTidy = (elements, groupIndex, op) => {
    const refs = spreadSoleGroup(elements, groupIndex, op.refs);
    const nodes = refs.map((ref) => ({ ref, bounds: boundsOf(elements, groupIndex, ref) })).filter((node) => node.bounds);
    if (nodes.length === 0) return { error: "no resolvable refs to tidy" };

    const refSet = new Set(refs);
    const memberToRef = new Map();
    refs.forEach((ref) => groupIndex.elementIdsForRef(ref).forEach((id) => memberToRef.set(id, ref)));

    const edges = Object.values(elements)
        .filter((element) => element.type === "connector")
        .map((connector) => ({ from: memberToRef.get(connector.startElementId), to: memberToRef.get(connector.endElementId) }))
        .filter((edge) => edge.from && edge.to && refSet.has(edge.from) && refSet.has(edge.to) && edge.from !== edge.to);

    const layoutNodes = nodes.map(({ ref, bounds }) => ({ id: ref, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY }));
    const positions = computeSimpleLayout(layoutNodes, edges, op.direction);

    const centers = nodes.map(({ bounds }) => boundsCenter(bounds));
    const originalCenterX = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
    const originalCenterY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
    const placedCenterX = Object.values(positions).reduce((sum, p) => sum + p.cx, 0) / Object.keys(positions).length;
    const placedCenterY = Object.values(positions).reduce((sum, p) => sum + p.cy, 0) / Object.keys(positions).length;

    const updatedById = {};
    nodes.forEach(({ ref, bounds }) => {
        const placed = positions[ref];
        if (!placed) return;
        const targetCenterX = placed.cx - placedCenterX + originalCenterX;
        const targetCenterY = placed.cy - placedCenterY + originalCenterY;
        const currentCenter = boundsCenter(bounds);
        const dx = targetCenterX - currentCenter.x;
        const dy = targetCenterY - currentCenter.y;
        if (dx === 0 && dy === 0) return;
        groupIndex.elementIdsForRef(ref).forEach((id) => {
            updatedById[id] = translateElement(elements[id], dx, dy);
        });
    });
    return { updatedById };
};

export const ARRANGE_EXECUTORS = {
    align: executeAlign,
    distribute: executeDistribute,
    place: executePlace,
    resizeToFit: executeResizeToFit,
    reorder: executeReorder,
    moveToFrame: executeMoveToFrame,
    tidy: executeTidy,
};
