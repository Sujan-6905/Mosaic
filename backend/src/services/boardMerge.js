// Merges a branch and its origin either way round, from the fork point or the last merge between them.
import { callerId } from "../models/accessControl.js";
import canvasStore from "../liveRooms/canvasStore.js";
import Drawing from "../models/drawingSchema.js";
import User from "../models/userSchema.js";
import { flushOperationLog, getLatestSeq, reconstructStateAtSeq } from "./operationLog.js";
import { applyElementDelete, applyElementUpsert } from "./canvasMutations.js";
import { currentElements, ensureRoomLoaded } from "./roomLoading.js";
import { saveCanvasToDB } from "./boards.js";
import { getIo } from "../realtime/ioRegistry.js";
import { findOverlaps, mergeCounts, planMerge, resolveMerge } from "../../../shared/canvas/history/threeWayMerge.js";
import { nullIfMissing } from "../db/errors.js";
import { loadMergeBase, saveMergeBase } from "../models/mergeBaseSchema.js";

export const MERGE_DIRECTIONS = ["intoParent", "fromParent"];

export class MergeRefused extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const findDrawing = (shareId) => nullIfMissing(() => Drawing.findOne({ shareId }));

// The two boards, which one receives the changes, and whether this person may do it.
const sidesFor = async (branchShareId, direction, caller) => {
    const branch = await findDrawing(branchShareId);
    if (!branch?.parentShareId) throw new MergeRefused(404, "This board isn't a branch of another board.");
    const parent = await findDrawing(branch.parentShareId);
    if (!parent) throw new MergeRefused(404, "The board this was branched from no longer exists.");
    const [target, source] = direction === "intoParent" ? [parent, branch] : [branch, parent];
    if (!target.hasEditAccess(caller)) throw new MergeRefused(403, `You need edit access to "${target.title}" to merge into it.`);
    if (!source.hasViewAccess(caller)) throw new MergeRefused(403, `You need access to "${source.title}" to merge from it.`);
    return { branch, parent, target, source };
};

// Branches made before bases were kept fall back to the version they were
// forked from, and failing that, to treating every difference as new.
const baseFor = async ({ branch, parent }) => {
    const kept = await loadMergeBase(branch.shareId);
    if (kept) return { elements: kept, approximate: false };
    if (branch.parentSeq == null) return { elements: {}, approximate: true };
    await flushOperationLog(parent.shareId);
    return { elements: (await reconstructStateAtSeq(parent.shareId, branch.parentSeq)).elements, approximate: false };
};

const planFor = async (branchShareId, direction, caller) => {
    const sides = await sidesFor(branchShareId, direction, caller);
    await flushOperationLog(sides.target.shareId);
    const [base, target, source, targetSeq] = await Promise.all([
        baseFor(sides),
        currentElements(sides.target.shareId),
        currentElements(sides.source.shareId),
        getLatestSeq(sides.target.shareId),
    ]);
    const states = { base: base.elements, target, source };
    return { sides, states, plan: planMerge(states), approximateBase: base.approximate, targetSeq };
};

// `caller` is a user id or the token's caller (see models/accessControl.js).
export const previewMerge = async ({ branchShareId, direction, caller }) => {
    const { sides, states, plan, approximateBase, targetSeq } = await planFor(branchShareId, direction, caller);
    return {
        direction,
        target: { shareId: sides.target.shareId, title: sides.target.title, elements: states.target },
        source: { shareId: sides.source.shareId, title: sides.source.title },
        ops: plan.ops,
        conflicts: plan.conflicts,
        counts: mergeCounts(plan.ops),
        overlaps: findOverlaps(states),
        approximateBase,
        targetSeq,
    };
};

// Applies exactly what was previewed, or refuses if the receiving board has
// changed since, so nobody merges something they didn't see.
export const applyMerge = async ({ branchShareId, direction, caller, choices, expectedTargetSeq }) => {
    const { sides, states, plan, targetSeq } = await planFor(branchShareId, direction, caller);
    const userId = callerId(caller);
    if (targetSeq !== expectedTargetSeq) throw new MergeRefused(409, `"${sides.target.title}" changed since this preview. Look it over again before merging.`);
    const ops = resolveMerge(plan, choices, states.target);
    await ensureRoomLoaded(sides.target.shareId);
    const author = await nullIfMissing(() => User.findById(userId));
    const context = { io: getIo(), canvasStore };
    const applied = [];
    for (const op of ops) {
        if (op.after) {
            const stamped = await applyElementUpsert(
                {
                    shareId: sides.target.shareId,
                    elementId: op.elementId,
                    element: op.after,
                    operation: op.before ? "update" : "insert",
                    authorId: userId,
                    authorName: author?.username,
                },
                context,
            );
            applied.push({ ...op, after: stamped });
        } else {
            await applyElementDelete({ shareId: sides.target.shareId, elementId: op.elementId, authorId: userId, authorName: author?.username }, context);
            applied.push(op);
        }
    }
    // Saved straight away rather than at the next sweep, so a room closing just
    // now, with nobody on the board, can't take the merge with it.
    await saveCanvasToDB({
        canvasShareId: sides.target.shareId,
        canvasElements: await canvasStore.getElements(sides.target.shareId),
        canvasBackground: await canvasStore.getBackground(sides.target.shareId),
    });
    await flushOperationLog(sides.target.shareId);
    // Both now agree on the side the changes came from, as it is now.
    await saveMergeBase(sides.branch.shareId, states.source);
    return { ops: applied, counts: mergeCounts(applied), target: { shareId: sides.target.shareId, title: sides.target.title } };
};
