import { buildDuplicatedElements } from "../editing/duplication.js";
import { translateElement } from "../geometry/elementGeometry.js";
import { getUnionBounds } from "../geometry/bounds.js";

// A piece is its elements moved to start at the origin, with piece-local ids. Arrows keep
// their ends on shapes inside the piece and let go of the rest.
export const pieceFromSelection = (elements, ids) => {
    const chosen = ids.filter((id) => elements[id]);
    const bounds = getUnionBounds(chosen.map((id) => elements[id]));
    if (!bounds) return null;
    const localIds = new Map(chosen.map((id, i) => [id, `p${i}`]));
    const inside = (id) => (id && localIds.has(id) ? localIds.get(id) : null);
    return Object.fromEntries(
        chosen.map((id) => {
            const element = translateElement(elements[id], -bounds.minX, -bounds.minY);
            const local = { ...element, groupId: element.groupId ?? null, frameId: inside(element.frameId), locked: false };
            if (local.type === "connector") {
                Object.assign(local, {
                    startElementId: inside(local.startElementId),
                    endElementId: inside(local.endElementId),
                    startAnchor: inside(local.startElementId) ? (local.startAnchor ?? null) : null,
                    endAnchor: inside(local.endElementId) ? (local.endAnchor ?? null) : null,
                });
            }
            return [localIds.get(id), local];
        }),
    );
};

// A piece as fresh board elements centred on (0, 0), ready to follow the pointer.
export const elementsFromPiece = (pieceElements, generateElementId) => {
    const ids = Object.keys(pieceElements);
    const bounds = getUnionBounds(Object.values(pieceElements));
    const offset = { dx: -(bounds.minX + bounds.maxX) / 2, dy: -(bounds.minY + bounds.maxY) / 2 };
    return buildDuplicatedElements(pieceElements, ids, offset, generateElementId, 0);
};
