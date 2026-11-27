const SERVER_STAMPS = new Set(["version", "updatedBy"]);

// Fields changed since the last server copy, so an update leaves a collaborator's
// concurrent change to other fields alone. Table cells are named one by one ("cells.4").
const MAX_NAMED_CELLS = 40;

const cellChanges = (before, after) => {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return ["cells"];
    const changed = after.flatMap((value, index) => (value === before[index] ? [] : [`cells.${index}`]));
    return changed.length > MAX_NAMED_CELLS ? ["cells"] : changed;
};

export const changedFields = (confirmed, element) =>
    [...new Set([...Object.keys(confirmed), ...Object.keys(element)])]
        .filter((key) => !SERVER_STAMPS.has(key) && JSON.stringify(confirmed[key]) !== JSON.stringify(element[key]))
        .flatMap((key) => (key === "cells" && element.type === "table" ? cellChanges(confirmed.cells, element.cells) : [key]));
