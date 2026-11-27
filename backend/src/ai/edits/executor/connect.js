import { getElementBounds, boundsCenter } from "../../../../../shared/canvas/geometry/bounds.js";
import { generateEditElementId, nextZIndex } from "./common.js";

const largestMemberElementId = (elements, memberIds) => {
    let winner = null;
    let winnerArea = -Infinity;
    memberIds.forEach((id) => {
        const bounds = getElementBounds(elements[id]);
        if (!bounds) return;
        const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
        if (area > winnerArea) {
            winner = id;
            winnerArea = area;
        }
    });
    return winner;
};

// Connectors carry no text, so a label is a small text element at the midpoint, which
// grounding attaches to the connector like a hand-drawn label.
const executeConnect = (elements, groupIndex, op) => {
    const aId = largestMemberElementId(elements, groupIndex.elementIdsForRef(op.refA));
    const bId = largestMemberElementId(elements, groupIndex.elementIdsForRef(op.refB));
    if (!aId || !bId) return { error: "connect requires two resolvable refs" };

    const aCenter = boundsCenter(getElementBounds(elements[aId]));
    const bCenter = boundsCenter(getElementBounds(elements[bId]));
    const connectorId = generateEditElementId();
    const newElementsById = {
        [connectorId]: {
            type: "connector",
            startX: aCenter.x,
            startY: aCenter.y,
            endX: bCenter.x,
            endY: bCenter.y,
            startElementId: aId,
            endElementId: bId,
            color: "#000000",
            colorToken: "ink-primary",
            size: 2,
            opacity: 100,
            arrowStart: false,
            arrowEnd: true,
            zIndex: nextZIndex(elements),
            rotation: 0,
        },
    };

    if (op.label) {
        const midX = (aCenter.x + bCenter.x) / 2;
        const midY = (aCenter.y + bCenter.y) / 2;
        newElementsById[generateEditElementId()] = {
            type: "text",
            x: midX - 40,
            y: midY - 10,
            width: 80,
            text: op.label,
            color: "#000000",
            colorToken: "ink-primary",
            size: 12,
            zIndex: nextZIndex(elements) + 1,
            rotation: 0,
        };
    }

    return { newElementsById };
};

const executeDisconnect = (elements, groupIndex, op) => {
    const aIds = new Set(groupIndex.elementIdsForRef(op.refA));
    const bIds = new Set(groupIndex.elementIdsForRef(op.refB));
    const deletedIds = Object.entries(elements)
        .filter(
            ([, element]) =>
                element.type === "connector" &&
                ((aIds.has(element.startElementId) && bIds.has(element.endElementId)) || (bIds.has(element.startElementId) && aIds.has(element.endElementId))),
        )
        .map(([id]) => id);
    if (deletedIds.length === 0) return { error: "no connector found between those refs" };
    return { deletedIds };
};

export const CONNECT_EXECUTORS = { connect: executeConnect, disconnect: executeDisconnect };
