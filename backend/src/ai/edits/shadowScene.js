// Applies a batch to a shallow copy of the elements for linting and preview. Untouched elements
// keep their identity, which the diff uses to skip them.
import { buildGroupIndex, executeOperation } from "./executor/index.js";
import { diffElements } from "../../../../shared/canvas/history/elementChanges.js";
import { batchRefIndex, CREATING_OPERATIONS } from "./editLanguage.js";

// Ops apply in order, so a later op sees an earlier one's results, and names what earlier ops
// created as new1, new2 and so on. A skipped op keeps its place in that numbering.
export const applyBatchToShadowScene = (elements, groupIndex, ops, skippedIndexes = new Set()) => {
    let shadow = { ...elements };
    const opResults = [];
    const created = [];
    const batchIndex = { elementIdsForRef: (ref) => (batchRefIndex(ref) === null ? groupIndex.elementIdsForRef(ref) : (created[batchRefIndex(ref)] ?? [])) };

    ops.forEach((op, index) => {
        const slot = CREATING_OPERATIONS.has(op.op) ? created.push([]) - 1 : null;
        if (skippedIndexes.has(index)) {
            opResults.push({ op, applied: false, skipped: true });
            return;
        }
        const result = executeOperation(shadow, batchIndex, op);
        if (result.error) {
            opResults.push({ op, applied: false, error: result.error });
            return;
        }

        const { updatedById = {}, newElementsById = {}, deletedIds = [] } = result;
        if (slot !== null) created[slot] = Object.keys(newElementsById);
        shadow = { ...shadow, ...updatedById, ...newElementsById };
        deletedIds.forEach((elementId) => {
            delete shadow[elementId];
        });
        opResults.push({ op, applied: true, updatedById, newElementsById, deletedIds });
    });

    return { shadow, opResults };
};

export { diffElements as diffShadowScene };
export { buildGroupIndex };
