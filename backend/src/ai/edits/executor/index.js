import { getBoundConnectorUpdates, releaseConnectorsFrom } from "../../../../../shared/canvas/elements/connectors.js";
import { applyFrameMembership } from "../../../../../shared/canvas/elements/frames.js";
import { ARRANGE_EXECUTORS } from "./arrange.js";
import { CONNECT_EXECUTORS } from "./connect.js";
import { CONTENT_EXECUTORS } from "./content.js";
import { ADDITION_EXECUTORS } from "./additions.js";
import { TRANSFORM_EXECUTORS } from "./transform.js";
import { executeCleanUp } from "./cleanUp.js";

// Each executor takes (elements, groupIndex, op) and returns { updatedById?, deletedIds?,
// newElementsById?, error? } without throwing, so one bad operation fails only itself.
const EXECUTORS = {
    ...ARRANGE_EXECUTORS,
    ...CONNECT_EXECUTORS,
    ...CONTENT_EXECUTORS,
    ...ADDITION_EXECUTORS,
    ...TRANSFORM_EXECUTORS,
    cleanUp: executeCleanUp,
};

// ref -> element ids from the grounded scene; a spread group's members answer to their own ids.
export const buildGroupIndex = (objects) => {
    const byRef = new Map(objects.map((object) => [object.ref, object.memberElementIds]));
    const memberIds = new Set(objects.flatMap((object) => object.memberElementIds));
    return { elementIdsForRef: (ref) => byRef.get(ref) ?? (memberIds.has(ref) ? [ref] : []) };
};

// Applies one validated operation, then rebinds connectors and frame membership the same
// way a person's drag does on the board.
export const executeOperation = (elements, groupIndex, op) => {
    const executor = EXECUTORS[op.op];
    if (!executor) return { error: `no executor for operation "${op.op}"` };

    const result = executor(elements, groupIndex, op);
    if (result.error) return result;

    const updatedById = result.updatedById || {};
    const newElementsById = result.newElementsById || {};
    const deletedIds = result.deletedIds || [];

    const mergedElements = { ...elements, ...updatedById, ...newElementsById };
    const changedIds = [...Object.keys(updatedById), ...Object.keys(newElementsById)];
    const connectorUpdates = changedIds.length > 0 ? getBoundConnectorUpdates(mergedElements, changedIds) : {};
    const membershipUpdates = changedIds.length > 0 ? applyFrameMembership(mergedElements, { ...updatedById, ...connectorUpdates }) : {};
    const unbindUpdates = deletedIds.length > 0 ? releaseConnectorsFrom(elements, deletedIds) : {};

    return {
        updatedById: { ...updatedById, ...connectorUpdates, ...membershipUpdates, ...unbindUpdates },
        newElementsById,
        deletedIds,
    };
};
