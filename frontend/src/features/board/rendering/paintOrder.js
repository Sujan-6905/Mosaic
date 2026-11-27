const byZIndex = ([, a], [, b]) => (a.zIndex ?? 0) - (b.zIndex ?? 0);

// Below this share of the board in view, sorting the visible elements beats
// filtering a sorted list of all of them.
const SORT_VISIBLE_ONLY_RATIO = 8;

// Low-to-high paint order. A pan keeps the same snapshot, so the full sort is
// kept until the snapshot changes.
export const createPaintOrder = () => {
    let sortedSnapshot = null;
    let sortedEntries = [];

    const allEntries = (snapshot) => {
        if (snapshot !== sortedSnapshot) {
            sortedEntries = Object.entries(snapshot).sort(byZIndex);
            sortedSnapshot = snapshot;
        }
        return sortedEntries;
    };

    const entriesFor = (snapshot, ids) => {
        const entries = [];
        for (const id of ids) {
            const element = snapshot[id];
            if (element) entries.push([id, element]);
        }
        return entries.sort(byZIndex);
    };

    const visibleEntries = (snapshot, visibleIds, totalCount) => {
        if (visibleIds.length * SORT_VISIBLE_ONLY_RATIO < totalCount) return entriesFor(snapshot, visibleIds);
        const visible = new Set(visibleIds);
        return allEntries(snapshot).filter(([id]) => visible.has(id));
    };

    return { allEntries, entriesFor, visibleEntries };
};
