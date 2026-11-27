import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";

const diffEntries = (diff) => [
    ...diff.added.map(({ elementId, element }) => ({ elementId, element })),
    ...diff.moved.map(({ elementId, after }) => ({ elementId, element: after })),
    ...diff.modified.map(({ elementId, after }) => ({ elementId, element: after })),
    ...diff.removed.map(({ elementId, element }) => ({ elementId, element })),
];

// A delete starts unticked, so removing something is always a choice someone makes.
export const initiallyAcceptedIndexes = (opsPreview) => opsPreview.filter((entry) => entry.op !== "delete").map((entry) => entry.index);

// The part of a diff the ticked operations produce. A change no operation claims
// came from the automatic layout repair, which applies whatever is ticked.
export const diffForAcceptedOps = (diff, opsPreview, acceptedIndexes) => {
    const accepted = new Set(acceptedIndexes);
    const claimedBy = new Map();
    for (const entry of opsPreview) {
        for (const elementId of entry.elementIds ?? []) {
            claimedBy.set(elementId, (claimedBy.get(elementId) ?? false) || accepted.has(entry.index));
        }
    }
    const keep = ({ elementId }) => claimedBy.get(elementId) ?? acceptedIndexes.length > 0;
    return {
        added: diff.added.filter(keep),
        removed: diff.removed.filter(keep),
        moved: diff.moved.filter(keep),
        modified: diff.modified.filter(keep),
    };
};

export const describeDiffCounts = (diff) =>
    [
        [diff.added.length, "added"],
        [diff.moved.length, "moved"],
        [diff.modified.length, "changed"],
        [diff.removed.length, "removed"],
    ]
        .filter(([count]) => count > 0)
        .map(([count, label]) => `${count} ${label}`)
        .join(", ");

export const boundsOfDiff = (diff, elementIds = null) => {
    const wanted = elementIds ? new Set(elementIds) : null;
    return getUnionBounds(
        diffEntries(diff)
            .filter(({ elementId }) => !wanted || wanted.has(elementId))
            .map(({ element }) => element),
    );
};

// Which of a proposal's elements someone has edited since it was made. An
// element the proposal adds doesn't exist yet, so only the others can go stale.
export const staleElementIds = (diff, elements) => {
    const before = [...diff.moved, ...diff.modified].map(({ elementId, before: original }) => [elementId, original]);
    const removed = diff.removed.map(({ elementId, element }) => [elementId, element]);
    return [...before, ...removed]
        .filter(([elementId, original]) => (elements[elementId]?.version ?? null) !== (original.version ?? null))
        .map(([elementId]) => elementId);
};
