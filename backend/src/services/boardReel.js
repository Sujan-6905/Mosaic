import { getDefaultInstance } from "ottoman";
import { applyOperation } from "../../../shared/canvas/history/operationReplay.js";
import { buildBoardPreview } from "./boardPreview.js";
import { flushOperationLog, reconstructStateAtSeq } from "./operationLog.js";
import logger from "../observability/logger.js";

// A reel replays at most this many of a board's latest changes, so a long history stays cheap to show.
const REEL_MAX_OPS = 2000;
const REEL_FRAMES = { fallback: 24, max: 120 };

// The board as thumbnails at evenly spaced points through `ops`, first frame the base, last the latest change.
export const sampleReelFrames = (base, ops, count) => {
    const state = { elements: { ...base.elements }, background: base.background };
    const frameOf = (seq) => ({ seq, elements: buildBoardPreview(state.elements).elements, background: state.background });
    if (ops.length === 0) return [frameOf(base.seq)];

    const steps = Math.min(count - 1, ops.length);
    const marks = new Set(Array.from({ length: steps }, (_, n) => Math.round(((n + 1) * ops.length) / steps) - 1));
    const frames = [frameOf(base.seq)];
    ops.forEach((op, index) => {
        applyOperation(state, op);
        if (marks.has(index)) frames.push(frameOf(op.seq));
    });
    return frames;
};

const query = async (statement, parameters) => (await getDefaultInstance().query(statement, { parameters })).rows;
const operationLogs = () => `\`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`operationLogs\``;

// A short, light replay of the whole board for a thumbnail, a time-lapse or a letter: preview frames, not windows.
export const loadReel = async (shareId, requestedFrames) => {
    const frameCount = Number.isInteger(requestedFrames) ? Math.max(2, Math.min(REEL_FRAMES.max, requestedFrames)) : REEL_FRAMES.fallback;
    await flushOperationLog(shareId).catch((error) => logger.warn({ err: error, shareId }, "reel read the log without the newest changes"));
    const [range] = await query(`SELECT MIN(ops.seq) AS firstSeq, MAX(ops.seq) AS latestSeq FROM ${operationLogs()} AS ops WHERE ops.shareId = $shareId`, {
        shareId,
    });
    const latestSeq = range?.latestSeq ?? 0;
    const startSeq = Math.max((range?.firstSeq ?? 1) - 1, latestSeq - REEL_MAX_OPS);
    const [base, ops] = await Promise.all([
        reconstructStateAtSeq(shareId, startSeq),
        query(
            `SELECT ops.seq, ops.opType, ops.elementId, ops.after FROM ${operationLogs()} AS ops
             WHERE ops.shareId = $shareId AND ops.seq > $startSeq ORDER BY ops.seq ASC LIMIT $limit`,
            { shareId, startSeq, limit: REEL_MAX_OPS },
        ),
    ]);
    return { latestSeq, frames: sampleReelFrames(base, ops, frameCount) };
};
