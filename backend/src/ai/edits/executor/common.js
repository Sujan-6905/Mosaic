import { boundsCenter, getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";

export const generateEditElementId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export const nextZIndex = (elements) => Math.max(0, ...Object.values(elements).map((element) => element.zIndex ?? 0)) + 1;

export const elementIdsForRefs = (groupIndex, refs) => [...new Set(refs.flatMap((ref) => groupIndex.elementIdsForRef(ref)))];

export const boundsOf = (elements, groupIndex, ref) =>
    getUnionBounds(
        groupIndex
            .elementIdsForRef(ref)
            .map((id) => elements[id])
            .filter(Boolean),
    );

// Close to the layout engine's node and rank spacing, a little wider between finished objects.
export const DEFAULT_GAP_BY_AXIS = { vertical: 96, horizontal: 48 };

export const gapFor = (relation) => DEFAULT_GAP_BY_AXIS[relation === "above" || relation === "below" ? "vertical" : "horizontal"];

export const placementDelta = (objectBounds, anchorBounds, relation, gap) => {
    const objectCenter = boundsCenter(objectBounds);
    const anchorCenter = boundsCenter(anchorBounds);
    switch (relation) {
        case "below":
            return { dx: anchorCenter.x - objectCenter.x, dy: anchorBounds.maxY + gap - objectBounds.minY };
        case "above":
            return { dx: anchorCenter.x - objectCenter.x, dy: anchorBounds.minY - gap - objectBounds.maxY };
        case "right-of":
            return { dx: anchorBounds.maxX + gap - objectBounds.minX, dy: anchorCenter.y - objectCenter.y };
        case "left-of":
            return { dx: anchorBounds.minX - gap - objectBounds.maxX, dy: anchorCenter.y - objectCenter.y };
        case "inside":
        default:
            return { dx: anchorCenter.x - objectCenter.x, dy: anchorCenter.y - objectCenter.y };
    }
};
