// planAgentEdit without the database: the same validation, sanitising, shadow application and
// repair functions, with a stand-in diff that only tracks which elements changed.
import { validateEditBatch } from "../../backend/src/ai/edits/editLanguage.js";
import { sanitizeEditBatch } from "../../backend/src/ai/edits/sanitize.js";
import { buildGroupIndex, executeOperation } from "../../backend/src/ai/edits/executor/index.js";
import { autoRepair, describeRemainingLints } from "../../backend/src/ai/edits/repair.js";

const diffOffline = (before, after) => {
    const added = [];
    const removed = [];
    const changed = [];

    for (const [elementId, afterElement] of Object.entries(after)) {
        const beforeElement = before[elementId];
        if (!beforeElement) {
            added.push({ elementId, element: afterElement });
            continue;
        }
        if (beforeElement === afterElement) continue;
        if (JSON.stringify(beforeElement) === JSON.stringify(afterElement)) continue;
        changed.push({ elementId, before: beforeElement, after: afterElement });
    }

    for (const elementId of Object.keys(before)) {
        if (!after[elementId]) removed.push({ elementId, element: before[elementId] });
    }

    return { added, removed, changed };
};

// Refs resolve against grounded objects, so group-aware ops behave as they do live.
export const planEditOffline = (elements, groundedObjects, rawEditBatch) => {
    const validation = validateEditBatch(rawEditBatch);
    if (!validation.valid) return { status: "invalid", error: validation.error };

    const editableObjects = groundedObjects.filter((object) => !object.locked);
    const validRefs = new Set(editableObjects.map((object) => object.ref));
    const { ops, events: sanitizeEvents } = sanitizeEditBatch(validation.ops, validRefs);
    if (ops.length === 0) {
        return { status: "rejected", reason: "no valid operations remained after sanitization", sanitizeEvents };
    }

    const groupIndex = buildGroupIndex(editableObjects);
    let shadow = { ...elements };
    ops.forEach((op) => {
        const result = executeOperation(shadow, groupIndex, op);
        if (result.error) return; // one bad op in a batch fails only that op, matching applyBatchToShadowScene
        const { updatedById = {}, newElementsById = {}, deletedIds = [] } = result;
        shadow = { ...shadow, ...updatedById, ...newElementsById };
        deletedIds.forEach((elementId) => {
            delete shadow[elementId];
        });
    });

    const { elements: repairedShadow, applied: autoRepairs, remainingLints } = autoRepair(shadow, elements);
    const diff = diffOffline(elements, repairedShadow);

    const blockingLints = remainingLints.filter((lint) => lint.severity === "error");
    if (blockingLints.length > 0) {
        return { status: "needs-repair", complaint: describeRemainingLints(blockingLints), diff, autoRepairs };
    }
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        return { status: "no-op", autoRepairs };
    }

    return { status: "planned", diff, autoRepairs, sanitizeEvents };
};
