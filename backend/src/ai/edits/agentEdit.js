// An agent edit end to end: validate, sanitise against the live scene, apply to a shadow copy, lint
// and repair; nothing reaches the board until commitPlannedEdit passes every check.
import { randomUUID } from "crypto";
import { getGroundedScene, invalidateGroundedScene } from "../../grounding/relationCache.js";
import { getLiveOrPersistedElements } from "../../liveRooms/liveScene.js";
import { getAccessForShareId } from "../../services/boards.js";
import { applyElementUpsert, applyElementDelete } from "../../services/canvasMutations.js";
import { validateEditBatch } from "./editLanguage.js";
import { sanitizeEditBatch } from "./sanitize.js";
import { buildGroupIndex, applyBatchToShadowScene, diffShadowScene } from "./shadowScene.js";
import { autoRepair, describeRemainingLints } from "./repair.js";
import { describeLintForPeople } from "./linter.js";
import { buildNameByRefMap, buildOpsPreview, describeOperation } from "./operationSummary.js";
import { savePlan, consumePlan, restorePlan } from "./previewStore.js";
import { hasAtLeastRank, ROLES } from "../../models/accessControl.js";
import { getIo } from "../../realtime/ioRegistry.js";
import canvasStore from "../../liveRooms/canvasStore.js";
import { recordSanitizationDrop, recordLintBlock } from "../../observability/metrics.js";

const DROP_EVENT_TYPES = new Set(["ref-dropped", "op-dropped", "duplicate-op-dropped"]);
const recordSanitizeEvents = (events) => events.forEach((event) => DROP_EVENT_TYPES.has(event.type) && recordSanitizationDrop());

const AGENT_ID = "mosaic-assistant";

const commitDiff = async ({ shareId, diff, userId, authorName, correlationId, io }) => {
    for (const entry of diff.added) {
        await applyElementUpsert(
            {
                shareId,
                elementId: entry.elementId,
                element: entry.element,
                operation: "insert",
                authorId: userId,
                authorName,
                agentId: AGENT_ID,
                correlationId,
            },
            { io, canvasStore },
        );
    }
    for (const entry of [...diff.moved, ...diff.modified]) {
        await applyElementUpsert(
            { shareId, elementId: entry.elementId, element: entry.after, operation: "update", authorId: userId, authorName, agentId: AGENT_ID, correlationId },
            { io, canvasStore },
        );
    }
    for (const entry of diff.removed) {
        await applyElementDelete({ shareId, elementId: entry.elementId, authorId: userId, authorName, agentId: AGENT_ID, correlationId }, { io, canvasStore });
    }
};

// Shared by planning (the whole batch) and committing (the batch with unticked ops skipped).
const shadowDiffFor = (elements, groundedObjects, ops, skippedIndexes) => {
    const groupIndex = buildGroupIndex(groundedObjects);
    const { shadow, opResults } = applyBatchToShadowScene(elements, groupIndex, ops, skippedIndexes);
    const failedOps = opResults.filter((result) => !result.applied && !result.skipped);
    const { elements: repairedShadow, applied: autoRepairs, remainingLints } = autoRepair(shadow, elements);
    const diff = diffShadowScene(elements, repairedShadow);
    const lints = remainingLints.map((lint) => ({ ...lint, notice: describeLintForPeople(lint, repairedShadow) }));
    return { diff, autoRepairs, failedOps, remainingLints: lints, opResults, groupIndex };
};

const REFERENCE_FIELDS = ["ref", "anchorRef", "refA", "refB", "frameRef"];

// Everything the batch changed or positioned against: "move A below B" is stale if B has moved.
const elementIdsDependedOn = (diff, ops, groupIndex) => {
    const ids = new Set();
    [...diff.moved, ...diff.modified, ...diff.removed].forEach((entry) => ids.add(entry.elementId));
    for (const op of ops) {
        const refs = [...(op.refs ?? []), ...REFERENCE_FIELDS.map((field) => op[field]).filter(Boolean)];
        refs.forEach((ref) => groupIndex.elementIdsForRef(ref).forEach((elementId) => ids.add(elementId)));
    }
    return ids;
};

// The store stamps these on every write, so they say nothing about the content.
const withoutStoreStamps = (element) => {
    if (!element) return element;
    const { version, updatedBy, ...content } = element;
    return content;
};

const sameElement = (a, b) => a === b || JSON.stringify(withoutStoreStamps(a)) === JSON.stringify(withoutStoreStamps(b));

const namesOfElements = (elementIds, objects) => {
    const wanted = new Set(elementIds);
    const names = objects.filter((object) => object.memberElementIds.some((elementId) => wanted.has(elementId))).map((object) => object.name);
    return [...new Set(names)];
};

// `drawing` is already access-checked; `rawEditBatch` is untrusted model output. Returns a planned
// { token, diff, opsPreview } to preview and later commit.
export const planAgentEdit = async ({ shareId, drawing, userId, rawEditBatch, tainted = false }) => {
    const validation = validateEditBatch(rawEditBatch);
    if (!validation.valid) return { status: "invalid", error: validation.error };

    const elements = await getLiveOrPersistedElements(shareId, drawing.elements);
    const groundedScene = await getGroundedScene(shareId, elements);
    // Locked objects never get a ref, so the model can't plan around one.
    const editableObjects = groundedScene.objects.filter((object) => !object.locked);
    const validRefs = new Set(editableObjects.map((object) => object.ref));

    const { ops, events: sanitizeEvents } = sanitizeEditBatch(validation.ops, validRefs);
    recordSanitizeEvents(sanitizeEvents);
    if (ops.length === 0) {
        return { status: "rejected", reason: "no valid operations remained after sanitization", sanitizeEvents };
    }

    const { diff, autoRepairs, failedOps, remainingLints, opResults } = shadowDiffFor(elements, editableObjects, ops);

    // Only error-level lints block; warnings are reported alongside.
    const blockingLints = remainingLints.filter((lint) => lint.severity === "error");
    if (blockingLints.length > 0) {
        recordLintBlock();
        return { status: "needs-repair", complaint: describeRemainingLints(blockingLints), failedOps, autoRepairs, diff };
    }

    if (diff.added.length === 0 && diff.removed.length === 0 && diff.moved.length === 0 && diff.modified.length === 0) {
        return { status: "no-op", failedOps, autoRepairs };
    }

    const nameByRef = buildNameByRefMap(groundedScene);
    const token = savePlan({ shareId, userId, ops, baseElements: elements, editableObjects, nameByRef, tainted });

    return {
        status: "planned",
        token,
        diff,
        opsPreview: buildOpsPreview(ops, nameByRef, opResults),
        autoRepairs,
        failedOps,
        skippedOps: failedOps.map((result) => describeOperation(result.op, nameByRef)),
        sanitizeEvents,
        remainingLints,
        tainted,
    };
};

// Re-checks access, then applies exactly the reviewed diff. Concurrency is checked per element read
// or written, leaving the proposal open to retry. `acceptedIndexes` commits a subset.
export const commitPlannedEdit = async ({ token, shareId, drawing, userId, correlationId, acceptedIndexes = null }) => {
    const plan = consumePlan(token, userId);
    if (!plan || plan.shareId !== shareId) return { status: "rejected", reason: "this preview has expired or was already resolved" };

    // A role can change mid-conversation.
    const access = await getAccessForShareId(shareId, userId);
    if (!hasAtLeastRank(access.role, ROLES.EDITOR)) {
        return { status: "unauthorized" };
    }

    const opsToApply = acceptedIndexes ? plan.ops.filter((_, index) => acceptedIndexes.includes(index)) : plan.ops;
    if (opsToApply.length === 0) return { status: "no-op" };

    const skippedIndexes = new Set(acceptedIndexes ? plan.ops.map((_, index) => index).filter((index) => !acceptedIndexes.includes(index)) : []);
    const { diff, autoRepairs, failedOps, remainingLints, groupIndex } = shadowDiffFor(plan.baseElements, plan.editableObjects, plan.ops, skippedIndexes);

    // The full batch already reported what it couldn't do when it was planned.
    // A subset failing where the whole didn't means a ticked operation needs an unticked one.
    if (acceptedIndexes && failedOps.length > 0) {
        restorePlan(token, plan);
        const needing = failedOps.map((result) => `"${describeOperation(result.op, plan.nameByRef)}"`).join(", ");
        return { status: "needs-dependency", message: `${needing} depends on a change you unticked. Tick it too, or ask for something different.` };
    }

    const blockingLints = remainingLints.filter((lint) => lint.severity === "error");
    if (blockingLints.length > 0) {
        recordLintBlock();
        restorePlan(token, plan);
        return { status: "needs-repair", complaint: describeRemainingLints(blockingLints), failedOps, autoRepairs, diff };
    }
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.moved.length === 0 && diff.modified.length === 0) {
        return { status: "no-op", failedOps, autoRepairs };
    }

    const liveElements = await getLiveOrPersistedElements(shareId, drawing.elements);
    const changedSinceReview = [...elementIdsDependedOn(diff, opsToApply, groupIndex)].filter(
        (elementId) => !sameElement(plan.baseElements[elementId], liveElements[elementId]),
    );
    if (changedSinceReview.length > 0) {
        restorePlan(token, plan);
        const conflicts = namesOfElements(changedSinceReview, plan.editableObjects);
        return {
            status: "conflict",
            conflicts,
            message: `${conflicts.length > 0 ? conflicts.join(", ") : "Something this edit uses"} changed after I proposed this. Update the proposal to redo it against the board as it is now.`,
        };
    }

    const io = getIo();
    const authorName = access.role === ROLES.OWNER ? "Owner" : userId;
    await commitDiff({ shareId, diff, userId, authorName, correlationId, io });
    invalidateGroundedScene(shareId);

    // Element events already applied the diff everywhere; this gives the requester the batch for
    // a single undo entry.
    const batchId = randomUUID();
    if (io) io.to(shareId).emit("server:agentEditApplied", { shareId, correlationId, requestedByUserId: userId, diff, batchId });

    return { status: "applied", diff, autoRepairs, failedOps, batchId };
};

// Re-plans a proposal's operations against the board as it is now, without a model call.
export const rebasePlannedEdit = async ({ token, shareId, drawing, userId }) => {
    const plan = consumePlan(token, userId);
    if (!plan || plan.shareId !== shareId) return { status: "rejected", reason: "this preview has expired or was already resolved" };
    return planAgentEdit({ shareId, drawing, userId, rawEditBatch: { ops: plan.ops }, tainted: plan.tainted });
};

// Undoes an applied edit however long ago it happened, leaving alone anything
// someone has changed since: restoring those would silently destroy later work.
export const revertAppliedEdit = async ({ shareId, drawing, userId, diff, batchId, correlationId }) => {
    const access = await getAccessForShareId(shareId, userId);
    if (!hasAtLeastRank(access.role, ROLES.EDITOR)) return { status: "unauthorized" };

    const elements = await getLiveOrPersistedElements(shareId, drawing.elements);
    const io = getIo();
    const authorName = access.role === ROLES.OWNER ? "Owner" : userId;
    const mutation = { shareId, authorId: userId, authorName, agentId: AGENT_ID, correlationId };
    const skippedIds = [];
    let restoredCount = 0;

    for (const { elementId, element } of diff.added) {
        if (!elements[elementId]) continue;
        if (!sameElement(element, elements[elementId])) {
            skippedIds.push(elementId);
            continue;
        }
        await applyElementDelete({ ...mutation, elementId }, { io, canvasStore });
        restoredCount += 1;
    }
    for (const { elementId, before, after } of [...diff.moved, ...diff.modified]) {
        if (!sameElement(after, elements[elementId])) {
            skippedIds.push(elementId);
            continue;
        }
        await applyElementUpsert({ ...mutation, elementId, element: before, operation: "update" }, { io, canvasStore });
        restoredCount += 1;
    }
    for (const { elementId, element } of diff.removed) {
        if (elements[elementId]) {
            skippedIds.push(elementId);
            continue;
        }
        await applyElementUpsert({ ...mutation, elementId, element, operation: "insert" }, { io, canvasStore });
        restoredCount += 1;
    }

    invalidateGroundedScene(shareId);
    if (io) io.to(shareId).emit("server:agentEditReverted", { shareId, requestedByUserId: userId, batchId });

    const groundedScene = await getGroundedScene(shareId, await getLiveOrPersistedElements(shareId, drawing.elements));
    return { status: "reverted", restoredCount, skipped: namesOfElements(skippedIds, groundedScene.objects) };
};

// A plan never touched anything, so rejecting only frees the token.
export const discardPlannedEdit = (token, userId) => consumePlan(token, userId) !== null;

// For callers with no review step (MCP's edit_board, auto-apply): plan, then commit at once.
export const applyAgentEdit = async ({ shareId, drawing, userId, correlationId, rawEditBatch }) => {
    const plan = await planAgentEdit({ shareId, drawing, userId, rawEditBatch });
    if (plan.status !== "planned") return plan;
    return commitPlannedEdit({ token: plan.token, shareId, drawing, userId, correlationId });
};
