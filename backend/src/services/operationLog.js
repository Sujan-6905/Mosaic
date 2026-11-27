// The append-only operation log and its snapshots: every accepted change is recorded, and any past state is rebuilt from it.
import { getDefaultInstance } from "ottoman";
import OperationLog from "../models/operationLogSchema.js";
import Snapshot from "../models/snapshotSchema.js";
import canvasStore from "../liveRooms/canvasStore.js";
import { getCollaboratorUsernames, loadDataFromDB } from "./boards.js";
import { resolveSnapshotOpInterval, resolveSnapshotTimeIntervalMs, resolveHistoryRetentionDays, resolveHistoryRetentionMinSnapshots } from "../config.js";
import logger from "../observability/logger.js";
import { applyOperation, DEFAULT_BACKGROUND } from "../../../shared/canvas/history/operationReplay.js";
import { recordActivity } from "./userActivity.js";
import { diffElements } from "../../../shared/canvas/history/elementChanges.js";

const bucketName = () => process.env.CB_BUCKET_NAME;

const FIRST_VERSION_AFTER_CHANGES = 20;

// Raw queries for what Ottoman's find() can't express: a seq range and the latest row.
const queryOpsInRange = async (shareId, fromSeqExclusive, toSeqInclusive) => {
    const ottoman = getDefaultInstance();
    const result = await ottoman.query(
        `SELECT operationLogs.* FROM \`${bucketName()}\`.\`app\`.\`operationLogs\` AS operationLogs
         WHERE shareId = $shareId AND seq > $fromSeq AND seq <= $toSeq
         ORDER BY seq ASC`,
        { parameters: { shareId, fromSeq: fromSeqExclusive, toSeq: toSeqInclusive } },
    );
    return result.rows;
};

// The durable latest seq, which survives a room closing; joining re-seeds the live counter
// from it so new ops never collide with logged ones.
const getLatestSeq = async (shareId) => {
    const ottoman = getDefaultInstance();
    const result = await ottoman.query(`SELECT MAX(seq) AS maxSeq FROM \`${bucketName()}\`.\`app\`.\`operationLogs\` WHERE shareId = $shareId`, {
        parameters: { shareId },
    });
    return result.rows[0]?.maxSeq || 0;
};

const queryLatestSnapshotAtOrBefore = async (shareId, targetSeq) => {
    const ottoman = getDefaultInstance();
    const result = await ottoman.query(
        `SELECT snapshots.*, META(snapshots).id AS _id FROM \`${bucketName()}\`.\`app\`.\`snapshots\` AS snapshots
         WHERE shareId = $shareId AND seq <= $targetSeq
         ORDER BY seq DESC LIMIT 1`,
        { parameters: { shareId, targetSeq } },
    );
    return result.rows[0] || null;
};

// Every snapshot, newest first; one per cadence tick, so small enough to load whole.
const queryAllSnapshotsDesc = async (shareId) => {
    const ottoman = getDefaultInstance();
    const result = await ottoman.query(
        `SELECT snapshots.*, META(snapshots).id AS _id FROM \`${bucketName()}\`.\`app\`.\`snapshots\` AS snapshots
         WHERE shareId = $shareId
         ORDER BY seq DESC`,
        { parameters: { shareId } },
    );
    return result.rows;
};

// The board at `targetSeq`: the newest snapshot at or before it (or empty), replayed forward.
const reconstructStateAtSeq = async (shareId, targetSeq) => {
    const snapshot = await queryLatestSnapshotAtOrBefore(shareId, targetSeq);
    const state = { elements: { ...(snapshot?.elements || {}) }, background: snapshot?.background || DEFAULT_BACKGROUND };
    const ops = await queryOpsInRange(shareId, snapshot?.seq || 0, targetSeq);
    ops.forEach((op) => applyOperation(state, op));
    return { ...state, seq: targetSeq };
};

// Called after every accepted mutation: assigns the seq and buffers the record, with no database write.
const appendOp = async ({ shareId, opType, elementId = null, after = null, authorId, authorName, agentId = null, correlationId = null }) => {
    const seq = await canvasStore.nextOpSeq(shareId);
    await canvasStore.appendPendingOp(shareId, {
        shareId,
        seq,
        opType,
        elementId,
        after,
        authorId,
        authorName: authorName || null,
        agentId,
        correlationId,
        ts: Date.now(),
    });
    return seq;
};

const distinctAuthorIds = (ops) => [...new Set(ops.map((op) => op.authorId).filter(Boolean))];

// Snapshots the live state, crediting whoever wrote the ops since the previous snapshot.
const liveState = async (shareId) => ({ elements: await canvasStore.getElements(shareId), background: await canvasStore.getBackground(shareId) });

const writeSnapshot = async (shareId, atSeq, opsSincePrevious, { name = null, automatic = true, authorId = null, authorName = null, state = null } = {}) => {
    const { elements, background } = state ?? (await liveState(shareId));

    return Snapshot.create({
        shareId,
        seq: atSeq,
        elements,
        background,
        name,
        automatic,
        authorId,
        authorName,
        contributors: distinctAuthorIds(opsSincePrevious),
    });
};

// Deletes automatic snapshots past retention (keeping `minSnapshots`) and the op rows they
// encode. A named version is never deleted.
const computeCompactionPlan = (snapshots, { retentionDays, minSnapshots, now }) => {
    const sorted = snapshots.filter((snapshot) => !snapshot.name).sort((a, b) => b.seq - a.seq);
    if (sorted.length <= minSnapshots) {
        return { toDeleteSnapshotIds: [], opsMaxSeqToDelete: null };
    }

    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    const withinWindow = sorted.filter((s) => new Date(s.createdAt || s.ts || 0).getTime() >= cutoff);
    const keepCount = Math.max(minSnapshots, withinWindow.length);
    const retained = sorted.slice(0, keepCount);
    const toDelete = sorted.slice(keepCount);

    if (toDelete.length === 0) {
        return { toDeleteSnapshotIds: [], opsMaxSeqToDelete: null };
    }

    const oldestRetainedSeq = retained[retained.length - 1].seq;
    return {
        toDeleteSnapshotIds: toDelete.map((s) => s._id),
        opsMaxSeqToDelete: oldestRetainedSeq,
    };
};

const compactHistory = async (shareId) => {
    const snapshots = await queryAllSnapshotsDesc(shareId);
    const plan = computeCompactionPlan(snapshots, {
        retentionDays: resolveHistoryRetentionDays(),
        minSnapshots: resolveHistoryRetentionMinSnapshots(),
        now: Date.now(),
    });

    if (plan.toDeleteSnapshotIds.length === 0) return plan;

    const ottoman = getDefaultInstance();
    await Promise.all(plan.toDeleteSnapshotIds.map((id) => Snapshot.removeById(id).catch(() => null)));
    if (plan.opsMaxSeqToDelete !== null) {
        await ottoman.query(
            `DELETE FROM \`${bucketName()}\`.\`app\`.\`operationLogs\`
             WHERE shareId = $shareId AND seq <= $maxSeq`,
            { parameters: { shareId, maxSeq: plan.opsMaxSeqToDelete } },
        );
    }
    return plan;
};

// Run by the autosave sweep: persists the buffered ops and snapshots when a cadence threshold passes.
const flushOperationLog = async (shareId) => {
    const ops = await canvasStore.drainPendingOps(shareId);
    if (ops.length === 0) return;

    // Only the writes that failed go back for the next sweep, so none is stored twice.
    const writes = await Promise.allSettled(ops.map((op) => OperationLog.create(op)));
    const failed = ops.filter((_, index) => writes[index].status === "rejected");
    if (failed.length > 0) {
        await canvasStore.requeuePendingOps(shareId, failed);
        throw writes.find((write) => write.status === "rejected").reason;
    }

    recordActivity(ops);

    const latestSeq = ops[ops.length - 1].seq;
    const latestSnapshot = await queryLatestSnapshotAtOrBefore(shareId, latestSeq);
    const opsSinceSnapshot = latestSnapshot ? ops.filter((op) => op.seq > latestSnapshot.seq) : ops;
    const msSinceSnapshot = latestSnapshot ? Date.now() - new Date(latestSnapshot.createdAt).getTime() : Infinity;

    // Counted across flushes, not within this one. A board's first version comes
    // early so a new board has one; the clock only runs once a version exists.
    const changesSinceVersion = latestSeq - (latestSnapshot?.seq ?? 0);
    const countThreshold = latestSnapshot ? resolveSnapshotOpInterval() : Math.min(FIRST_VERSION_AFTER_CHANGES, resolveSnapshotOpInterval());
    const dueByCount = changesSinceVersion >= countThreshold;
    const dueByTime = latestSnapshot !== null && msSinceSnapshot >= resolveSnapshotTimeIntervalMs();

    if (dueByCount || dueByTime) {
        await writeSnapshot(shareId, latestSeq, opsSinceSnapshot);
        await compactHistory(shareId).catch((error) => {
            logger.error({ err: error, shareId }, "history compaction failed");
        });
    }
};

// Automatic and named versions are the same rows; a name is just shown when present.
const getVersions = async (shareId) => {
    const snapshots = await queryAllSnapshotsDesc(shareId);
    return snapshots.map((s) => ({
        seq: s.seq,
        name: s.name,
        automatic: s.automatic,
        authorName: s.authorName,
        contributors: s.contributors || [],
        createdAt: s.createdAt,
    }));
};

// Snapshots now: the live room flushed first, else the saved board, so a version is never empty.
const createNamedVersion = async (shareId, { name, authorId, authorName }) => {
    const details = { name, automatic: false, authorId, authorName };
    if (await canvasStore.roomExists(shareId)) {
        await flushOperationLog(shareId);
        return writeSnapshot(shareId, await canvasStore.currentOpSeq(shareId), [], details);
    }
    const saved = await loadDataFromDB(shareId);
    const state = { elements: saved?.elements ?? {}, background: saved?.background ?? DEFAULT_BACKGROUND };
    return writeSnapshot(shareId, await getLatestSeq(shareId), [], { ...details, state });
};

// The {elementId, before, after} changes back to a past version, the shape of a batch undo entry.
const diffToRestore = async (shareId, targetSeq) => {
    const target = await reconstructStateAtSeq(shareId, targetSeq);
    const current = await canvasStore.getElements(shareId);
    const currentBackground = await canvasStore.getBackground(shareId);

    const ops = [];
    for (const [elementId, after] of Object.entries(target.elements)) {
        if (JSON.stringify(current[elementId]) !== JSON.stringify(after)) {
            ops.push({ elementId, before: current[elementId] || null, after });
        }
    }
    for (const elementId of Object.keys(current)) {
        if (!(elementId in target.elements)) {
            ops.push({ elementId, before: current[elementId], after: null });
        }
    }

    const backgroundChanged = JSON.stringify(currentBackground) !== JSON.stringify(target.background);
    return { elementOps: ops, background: backgroundChanged ? target.background : null };
};

// Compares two {shareId, seq} states, possibly different boards.
const diffVersions = async (refA, refB) => {
    const [stateA, stateB] = await Promise.all([reconstructStateAtSeq(refA.shareId, refA.seq), reconstructStateAtSeq(refB.shareId, refB.seq)]);
    const authored = (entry) => ({ ...entry, authorId: (entry.after ?? entry.element).updatedBy || null });
    const diff = diffElements(stateA.elements, stateB.elements);
    const [added, removed, moved, modified] = [diff.added, diff.removed, diff.moved, diff.modified].map((entries) => entries.map(authored));

    const byType = { added: added.length, removed: removed.length, moved: moved.length, modified: modified.length };
    const changes = [...added, ...removed, ...moved, ...modified];
    const usernames = await getCollaboratorUsernames(new Set(changes.map(({ authorId }) => authorId).filter(Boolean)));
    const byAuthor = {};
    changes.forEach(({ authorId }) => {
        const key = usernames.get(authorId) ?? "Someone";
        byAuthor[key] = (byAuthor[key] || 0) + 1;
    });

    return { added, removed, moved, modified, summary: { byType, byAuthor } };
};

export {
    appendOp,
    flushOperationLog,
    getLatestSeq,
    reconstructStateAtSeq,
    getVersions,
    createNamedVersion,
    diffToRestore,
    diffVersions,
    computeCompactionPlan,
};
