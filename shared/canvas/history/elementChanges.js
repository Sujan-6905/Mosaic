// "Moved" is a pure geometry change; anything else changing too is "modified".
const GEOMETRY_KEYS = ["x", "y", "startX", "startY", "endX", "endY"];
// Stamped by the server on every write, so they differ even when nothing a person sees did.
const STAMP_KEYS = ["version", "updatedBy"];

const omitKeys = (element, keys) => Object.fromEntries(Object.entries(element).filter(([key]) => !keys.includes(key)));
const sameContent = (before, after) => before === after || JSON.stringify(omitKeys(before, STAMP_KEYS)) === JSON.stringify(omitKeys(after, STAMP_KEYS));

export const classifyChange = (before, after) => {
    const geometryChanged = GEOMETRY_KEYS.some((key) => before[key] !== after[key]);
    const pointsChanged = JSON.stringify(before.points) !== JSON.stringify(after.points);
    const restChanged =
        JSON.stringify(omitKeys(before, [...GEOMETRY_KEYS, "points", ...STAMP_KEYS])) !==
        JSON.stringify(omitKeys(after, [...GEOMETRY_KEYS, "points", ...STAMP_KEYS]));
    return (geometryChanged || pointsChanged) && !restChanged ? "moved" : "modified";
};

// Two element maps as added, removed, moved and modified; the vocabulary of version diffs and edit previews.
export const diffElements = (before, after) => {
    const added = [];
    const removed = [];
    const moved = [];
    const modified = [];
    for (const [elementId, afterElement] of Object.entries(after)) {
        const beforeElement = before[elementId];
        if (!beforeElement) added.push({ elementId, element: afterElement });
        else if (!sameContent(beforeElement, afterElement)) {
            const entry = { elementId, before: beforeElement, after: afterElement };
            (classifyChange(beforeElement, afterElement) === "moved" ? moved : modified).push(entry);
        }
    }
    for (const [elementId, beforeElement] of Object.entries(before)) {
        if (!after[elementId]) removed.push({ elementId, element: beforeElement });
    }
    return { added, removed, moved, modified };
};
