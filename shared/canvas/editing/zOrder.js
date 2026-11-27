// Stacking order is a float per element, so moving one never rewrites another's value.

// Just above everything already there, from an elements map or a list of elements.
export const nextZIndex = (elements) => Object.values(elements).reduce((max, element) => Math.max(max, element.zIndex ?? 0), 0) + 1;

const sortedByZIndex = (elementsMap) => Object.entries(elementsMap).sort(([, a], [, b]) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

// The moved elements go as one block above the max or below the min, keeping their order.
export const bringToFront = (elementsMap, ids) => {
    const idSet = new Set(ids);
    const zIndexes = Object.values(elementsMap).map((element) => element.zIndex ?? 0);
    const maxZ = zIndexes.length ? Math.max(...zIndexes) : 0;
    const moving = sortedByZIndex(elementsMap).filter(([id]) => idSet.has(id));
    const updates = {};
    moving.forEach(([id], i) => {
        updates[id] = maxZ + i + 1;
    });
    return updates;
};

export const sendToBack = (elementsMap, ids) => {
    const idSet = new Set(ids);
    const zIndexes = Object.values(elementsMap).map((element) => element.zIndex ?? 0);
    const minZ = zIndexes.length ? Math.min(...zIndexes) : 0;
    const moving = sortedByZIndex(elementsMap).filter(([id]) => idSet.has(id));
    const updates = {};
    moving.forEach(([id], i) => {
        updates[id] = minZ - (moving.length - i);
    });
    return updates;
};

// Adjacent selected elements move past their blocker together as one run.
const selectedRuns = (order, selected) => {
    const runs = [];
    let start = null;
    order.forEach((id, i) => {
        if (selected.has(id)) {
            if (start === null) start = i;
        } else if (start !== null) {
            runs.push([start, i - 1]);
            start = null;
        }
    });
    if (start !== null) runs.push([start, order.length - 1]);
    return runs;
};

const zIndexAt = (sorted, i, fallback) => (sorted[i] ? (sorted[i][1].zIndex ?? 0) : fallback);

// Fits each run into the gap beyond its blocking neighbour. Higher runs go first so a
// lower run's new gap never lands inside one already claimed.
export const bringForward = (elementsMap, ids) => {
    const selected = new Set(ids);
    const sorted = sortedByZIndex(elementsMap);
    const order = sorted.map(([id]) => id);
    const updates = {};

    selectedRuns(order, selected)
        .reverse()
        .forEach(([start, end]) => {
            const blockerIndex = end + 1;
            if (blockerIndex >= order.length) return; // run is already at the very top
            const floor = zIndexAt(sorted, blockerIndex, 0);
            const ceiling = zIndexAt(sorted, blockerIndex + 1, floor + 1);
            const span = end - start + 1;
            for (let k = 0; k < span; k++) {
                updates[order[start + k]] = floor + ((ceiling - floor) * (k + 1)) / (span + 1);
            }
        });

    return updates;
};

export const sendBackward = (elementsMap, ids) => {
    const selected = new Set(ids);
    const sorted = sortedByZIndex(elementsMap);
    const order = sorted.map(([id]) => id);
    const updates = {};

    selectedRuns(order, selected).forEach(([start, end]) => {
        const blockerIndex = start - 1;
        if (blockerIndex < 0) return; // run is already at the very bottom
        const ceiling = zIndexAt(sorted, blockerIndex, 0);
        const floor = zIndexAt(sorted, blockerIndex - 1, ceiling - 1);
        const span = end - start + 1;
        for (let k = 0; k < span; k++) {
            updates[order[start + k]] = floor + ((ceiling - floor) * (k + 1)) / (span + 1);
        }
    });

    return updates;
};
