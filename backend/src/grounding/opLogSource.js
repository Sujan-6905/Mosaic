// Recent authorship for temporal grouping: the unflushed buffer plus a bounded query of the
// saved log, so bursts survive an autosave drain.
import { getDefaultInstance } from "ottoman";
import canvasStore from "../liveRooms/canvasStore.js";
import logger from "../observability/logger.js";

// Spans a drawing burst (gaps top out at 4s) while keeping the query cheap.
const RECENT_WINDOW_MS = 5 * 60 * 1000;

const bucketName = () => process.env.CB_BUCKET_NAME;

const queryRecentPersistedOps = async (shareId, sinceTs) => {
    try {
        const ottoman = getDefaultInstance();
        const result = await ottoman.query(
            `SELECT operationLogs.elementId, operationLogs.authorId, operationLogs.ts
             FROM \`${bucketName()}\`.\`app\`.\`operationLogs\` AS operationLogs
             WHERE shareId = $shareId AND ts >= $sinceTs AND opType != "delete" AND elementId IS NOT NULL
             ORDER BY seq ASC`,
            { parameters: { shareId, sinceTs } },
        );
        return result.rows;
    } catch (error) {
        // Without a database the buffer alone is used; grouping reports itself degraded if that's empty.
        logger.warn({ err: error, shareId }, "recent op-log query failed, falling back to pending ops only");
        return [];
    }
};

export const getRecentOpEntries = async (shareId) => {
    const sinceTs = Date.now() - RECENT_WINDOW_MS;
    const [persisted, pending] = await Promise.all([queryRecentPersistedOps(shareId, sinceTs), canvasStore.peekPendingOps(shareId)]);

    const recentPending = pending
        .filter((op) => op.ts >= sinceTs && op.opType !== "delete" && op.elementId)
        .map(({ elementId, authorId, ts }) => ({ elementId, authorId, ts }));

    return [...persisted, ...recentPending];
};
