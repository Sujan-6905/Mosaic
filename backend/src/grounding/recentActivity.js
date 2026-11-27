// People's recent actions for the assistant's context, excluding agent ops so the model is never
// told about its own edit. Falls back to the buffer if the query fails.
import { getDefaultInstance } from "ottoman";
import canvasStore from "../liveRooms/canvasStore.js";
import logger from "../observability/logger.js";

const RECENT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 8;

const bucketName = () => process.env.CB_BUCKET_NAME;

const queryRecentPersistedOps = async (shareId, userId, sinceTs) => {
    try {
        const ottoman = getDefaultInstance();
        const result = await ottoman.query(
            `SELECT operationLogs.opType, operationLogs.elementId, operationLogs.ts
             FROM \`${bucketName()}\`.\`app\`.\`operationLogs\` AS operationLogs
             WHERE shareId = $shareId AND authorId = $userId AND agentId IS NULL AND ts >= $sinceTs
             ORDER BY seq DESC
             LIMIT ${MAX_ENTRIES}`,
            { parameters: { shareId, userId, sinceTs } },
        );
        return result.rows;
    } catch (error) {
        logger.warn({ err: error, shareId }, "recent activity query failed, falling back to pending ops only");
        return [];
    }
};

export const getRecentUserActions = async (shareId, userId) => {
    const sinceTs = Date.now() - RECENT_WINDOW_MS;
    const [persisted, pending] = await Promise.all([queryRecentPersistedOps(shareId, userId, sinceTs), canvasStore.peekPendingOps(shareId)]);

    const recentPending = pending
        .filter((op) => op.ts >= sinceTs && op.authorId === userId && !op.agentId)
        .map(({ opType, elementId, ts }) => ({ opType, elementId, ts }));

    return [...persisted, ...recentPending].sort((a, b) => b.ts - a.ts).slice(0, MAX_ENTRIES);
};

const OP_VERBS = { insert: "added", update: "changed", delete: "deleted" };

// Short phrases naming the object by its current name, or a bare verb when it no longer exists.
export const summarizeRecentActions = (actions, groundedScene) => {
    const nameByElementId = new Map();
    groundedScene.objects.forEach((object) => {
        (object.memberElementIds ?? [object.elementId]).forEach((elementId) => nameByElementId.set(elementId, object.name));
    });

    return actions.map(({ opType, elementId, ts }) => {
        const verb = OP_VERBS[opType] || opType;
        const name = elementId ? nameByElementId.get(elementId) : null;
        return { summary: name ? `${verb} "${name}"` : `${verb} an element`, ts };
    });
};
