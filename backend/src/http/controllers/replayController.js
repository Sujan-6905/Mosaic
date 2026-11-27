import { getDefaultInstance } from "ottoman";
import logger from "../../observability/logger.js";
import { flushOperationLog, reconstructStateAtSeq } from "../../services/operationLog.js";
import { loadReel } from "../../services/boardReel.js";

export const REPLAY_WINDOW_SIZE = 300;
const MAX_AUTHOR_ID_LENGTH = 200;

const NOTABLE_BATCH_SIZE = 10;
const NOTABLE_BATCH_WINDOW_MS = 2000;
const SESSION_GAP_MS = 5 * 60 * 1000;

const operationLogs = () => `\`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`operationLogs\``;

const query = async (statement, parameters) => (await getDefaultInstance().query(statement, { parameters })).rows;

// A burst of edits (a paste, an assistant diagram, a multi-delete) or the
// first change after a long silence. Needs only seq and ts, never the elements.
export const detectNotableMoments = (rows) => {
    const moments = [];
    let windowStart = 0;

    for (let i = 0; i < rows.length; i++) {
        if (i > 0 && rows[i].ts - rows[i - 1].ts >= SESSION_GAP_MS) {
            moments.push({ seq: rows[i].seq, label: "New session" });
            windowStart = i;
        }
        while (rows[i].ts - rows[windowStart].ts > NOTABLE_BATCH_WINDOW_MS) windowStart++;
        if (i - windowStart + 1 === NOTABLE_BATCH_SIZE) {
            moments.push({ seq: rows[i].seq, label: "Burst of edits" });
        }
    }
    return moments;
};

const listAuthors = (rows) => {
    const names = new Map();
    rows.forEach(({ authorId, authorName }) => {
        if (authorId && !names.has(authorId)) names.set(authorId, authorName || authorId);
    });
    return [...names].map(([id, name]) => ({ id, name }));
};

// Compaction folds the oldest changes into a snapshot, so the earliest point
// replay can show is just before the first change still logged.
const getReplayTimelineHandler = async (req, res) => {
    const { shareId } = req.params;
    try {
        await flushOperationLog(shareId).catch((error) => logger.warn({ err: error, shareId }, "replay read the log without the newest changes"));
        const rows = await query(
            `SELECT ops.seq, ops.ts, ops.authorId, ops.authorName FROM ${operationLogs()} AS ops
             WHERE ops.shareId = $shareId ORDER BY ops.seq ASC`,
            { shareId },
        );
        return res.status(200).json({
            firstSeq: rows.length > 0 ? rows[0].seq - 1 : 0,
            latestSeq: rows.at(-1)?.seq ?? 0,
            authors: listAuthors(rows),
            moments: detectNotableMoments(rows),
        });
    } catch (error) {
        logger.error({ err: error, shareId }, "error fetching replay timeline");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const seqBeforeNextChangeBy = async (shareId, authorId, afterSeq) => {
    const [row] = await query(
        `SELECT MIN(ops.seq) AS nextSeq FROM ${operationLogs()} AS ops
         WHERE ops.shareId = $shareId AND ops.seq > $afterSeq AND ops.authorId = $authorId`,
        { shareId, afterSeq, authorId },
    );
    return row?.nextSeq ? row.nextSeq - 1 : null;
};

// The board at `seq` plus the changes after it, so the scrubber builds frames locally; with
// `authorId` the window starts just before that person's next change.
const getReplayWindowHandler = async (req, res) => {
    const { shareId } = req.params;
    const seq = Number(req.query.seq);
    const authorId = req.query.authorId;
    if (!Number.isInteger(seq) || seq < 0) {
        return res.status(400).json({ message: "seq must be a non-negative whole number" });
    }
    if (authorId !== undefined && (typeof authorId !== "string" || authorId.length === 0 || authorId.length > MAX_AUTHOR_ID_LENGTH)) {
        return res.status(400).json({ message: "invalid authorId" });
    }

    try {
        const baseSeq = authorId ? await seqBeforeNextChangeBy(shareId, authorId, seq) : seq;
        if (baseSeq === null) return res.status(200).json({ exhausted: true });

        const [base, rows] = await Promise.all([
            reconstructStateAtSeq(shareId, baseSeq),
            query(
                `SELECT ops.seq, ops.opType, ops.elementId, ops.after, ops.authorId, ops.authorName, ops.ts
                 FROM ${operationLogs()} AS ops
                 WHERE ops.shareId = $shareId AND ops.seq > $baseSeq
                 ORDER BY ops.seq ASC LIMIT $limit`,
                { shareId, baseSeq, limit: REPLAY_WINDOW_SIZE + 1 },
            ),
        ]);
        return res.status(200).json({
            baseSeq,
            elements: base.elements,
            background: base.background,
            ops: rows.slice(0, REPLAY_WINDOW_SIZE),
            hasMore: rows.length > REPLAY_WINDOW_SIZE,
        });
    } catch (error) {
        logger.error({ err: error, shareId }, "error fetching replay window");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// A short, light replay of the whole board for a thumbnail or a time-lapse: preview frames, not windows.
const getReplayReelHandler = async (req, res) => {
    const { shareId } = req.params;
    try {
        return res.status(200).json(await loadReel(shareId, Number.parseInt(req.query.frames, 10)));
    } catch (error) {
        logger.error({ err: error, shareId }, "error fetching replay reel");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getReplayTimelineHandler, getReplayWindowHandler, getReplayReelHandler };
