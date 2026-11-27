import { translateElement } from "../geometry/elementGeometry.js";

// Fresh copies for duplicate and paste: new ids, a new group per source group, unlocked,
// and stacked above `zIndexBase` in the sources' own relative order.
export const buildDuplicatedElements = (elementsMap, ids, offset, generateId, zIndexBase) => {
    const groupIdMap = new Map();
    const remapGroupId = (groupId) => {
        if (!groupId) return null;
        if (!groupIdMap.has(groupId)) groupIdMap.set(groupId, generateId());
        return groupIdMap.get(groupId);
    };

    // Copies keep pointing at each other: an arrow between two copied shapes joins
    // the copies, and one whose target stayed behind lets go of it where it lies.
    const sources = ids.filter((id) => elementsMap[id]).sort((a, b) => (elementsMap[a].zIndex ?? 0) - (elementsMap[b].zIndex ?? 0));
    const newIds = new Map(sources.map((id) => [id, generateId()]));
    const rebind = (element) => {
        if (element.type !== "connector") return element;
        const end = (elementId, anchor) => (elementId && newIds.has(elementId) ? [newIds.get(elementId), anchor] : [null, null]);
        const [startElementId, startAnchor] = end(element.startElementId, element.startAnchor);
        const [endElementId, endAnchor] = end(element.endElementId, element.endAnchor);
        return { ...element, startElementId, startAnchor, endElementId, endAnchor };
    };

    return sources.map((id, i) => {
        const element = elementsMap[id];
        return {
            elementId: newIds.get(id),
            element: {
                ...rebind(translateElement(element, offset.dx, offset.dy)),
                groupId: remapGroupId(element.groupId),
                frameId: element.frameId && newIds.has(element.frameId) ? newIds.get(element.frameId) : (element.frameId ?? null),
                locked: false,
                zIndex: zIndexBase + i + 1,
            },
        };
    });
};
