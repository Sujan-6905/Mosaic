// What agents did on a board, one tool call (a "turn") at a time, and undoing
// one turn without trampling anything a person changed afterwards.
import { getDefaultInstance } from "ottoman";
import canvasStore from "../liveRooms/canvasStore.js";
import User from "../models/userSchema.js";
import { nullIfMissing } from "../db/errors.js";
import { getIo } from "../realtime/ioRegistry.js";
import { flushOperationLog, reconstructStateAtSeq } from "./operationLog.js";
import { saveCanvasToDB } from "./boards.js";
import { applyElementDelete, applyElementUpsert } from "./canvasMutations.js";
import { ensureRoomLoaded } from "./roomLoading.js";

const RECENT_AGENT_OPS = 2000;
const OPS = () => `\`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`operationLogs\``;

const query = async (statement, parameters) => (await getDefaultInstance().query(statement, { parameters })).rows;

const summarise = (ops) => {
    const first = ops[ops.length - 1];
    const last = ops[0];
    return {
        turnId: last.correlationId,
        agent: last.agentId,
        authorName: last.authorName,
        firstSeq: first.seq,
        lastSeq: last.seq,
        at: last.ts,
        elementIds: [...new Set(ops.map((op) => op.elementId).filter(Boolean))],
        counts: {
            added: ops.filter((op) => op.opType === "insert").length,
            changed: ops.filter((op) => op.opType === "update" || op.opType === "background").length,
            removed: ops.filter((op) => op.opType === "delete").length,
        },
    };
};

// Newest turn first.
export const listAgentTurns = async (shareId, { limit = 30 } = {}) => {
    await flushOperationLog(shareId);
    const ops = await query(
        `SELECT seq, opType, elementId, authorName, agentId, correlationId, ts FROM ${OPS()}
         WHERE shareId = $shareId AND agentId IS NOT NULL AND correlationId IS NOT NULL ORDER BY seq DESC LIMIT ${RECENT_AGENT_OPS}`,
        { shareId },
    );
    const byTurn = new Map();
    ops.forEach((op) => {
        if (!byTurn.has(op.correlationId)) byTurn.set(op.correlationId, []);
        byTurn.get(op.correlationId).push(op);
    });
    return [...byTurn.values()].slice(0, limit).map(summarise);
};

export class UndoRefused extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Puts each element the turn touched back the way it was before the turn,
// unless someone changed it since; those are reported and left alone.
export const undoAgentTurn = async (shareId, turnId, { userId }) => {
    await flushOperationLog(shareId);
    const ops = await query(`SELECT seq, elementId FROM ${OPS()} WHERE shareId = $shareId AND correlationId = $turnId AND agentId IS NOT NULL ORDER BY seq`, {
        shareId,
        turnId,
    });
    if (ops.length === 0) throw new UndoRefused(404, "That agent turn isn't on this board.");
    const firstSeq = ops[0].seq;
    const lastSeq = ops[ops.length - 1].seq;
    const touched = [...new Set(ops.map((op) => op.elementId).filter(Boolean))];
    const laterRows = touched.length
        ? await query(`SELECT DISTINCT elementId FROM ${OPS()} WHERE shareId = $shareId AND seq > $lastSeq AND elementId IN $ids`, {
              shareId,
              lastSeq,
              ids: touched,
          })
        : [];
    const changedSince = new Set(laterRows.map((row) => row.elementId));
    // Sequence numbers start at 1: a turn that began there had an empty board before it.
    const before = firstSeq > 1 ? (await reconstructStateAtSeq(shareId, firstSeq - 1)).elements : {};

    await ensureRoomLoaded(shareId);
    const author = await nullIfMissing(() => User.findById(userId));
    const context = { io: getIo(), canvasStore };
    const current = await canvasStore.getElements(shareId);
    let restored = 0;
    let removed = 0;
    for (const elementId of touched) {
        if (changedSince.has(elementId)) continue;
        if (before[elementId]) {
            await applyElementUpsert(
                {
                    shareId,
                    elementId,
                    element: before[elementId],
                    operation: current[elementId] ? "update" : "insert",
                    authorId: userId,
                    authorName: author?.username,
                },
                context,
            );
            restored += 1;
        } else if (current[elementId]) {
            await applyElementDelete({ shareId, elementId, authorId: userId, authorName: author?.username }, context);
            removed += 1;
        }
    }
    await saveCanvasToDB({
        canvasShareId: shareId,
        canvasElements: await canvasStore.getElements(shareId),
        canvasBackground: await canvasStore.getBackground(shareId),
    });
    await flushOperationLog(shareId);
    return { restored, removed, skipped: [...changedSince] };
};
