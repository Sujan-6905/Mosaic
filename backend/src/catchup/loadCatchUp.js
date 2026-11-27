import { getDefaultInstance } from "ottoman";
import canvasStore from "../liveRooms/canvasStore.js";
import BoardVisit from "../models/boardVisitSchema.js";
import Comment from "../models/commentSchema.js";
import User from "../models/userSchema.js";
import { reconstructStateAtSeq } from "../services/operationLog.js";
import { classifyChange } from "../../../shared/canvas/history/elementChanges.js";
import { getLiveOrPersistedElements } from "../liveRooms/liveScene.js";
import { getGroundedScene } from "../grounding/relationCache.js";
import { getElementBounds } from "../../../shared/canvas/geometry/bounds.js";
import logger from "../observability/logger.js";
import { buildCatchUpDigest } from "./digest.js";

const MAX_OPS = 5000;

const queryPersistedOpsSince = async (shareId, sinceTs) => {
    const result = await getDefaultInstance().query(
        `SELECT operationLogs.seq, operationLogs.opType, operationLogs.elementId, operationLogs.authorId, operationLogs.agentId, operationLogs.ts
         FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`operationLogs\` AS operationLogs
         WHERE shareId = $shareId AND ts > $sinceTs
         ORDER BY seq DESC
         LIMIT ${MAX_OPS}`,
        { parameters: { shareId, sinceTs } },
    );
    return result.rows;
};

const resolveSince = async (shareId, userId, requestedSince) => {
    if (requestedSince) return requestedSince;
    const { rows } = await BoardVisit.find({ shareId, userId });
    return rows[0]?.lastSeenAt ?? null;
};

const userNamesFor = async (userIds) => {
    const entries = await Promise.all(
        userIds.map(async (userId) => {
            const user = await User.findById(userId).catch(() => null);
            return [userId, user?.username ?? "Someone"];
        }),
    );
    return new Map(entries);
};

// Null when there's nothing to compare against, as on someone's first visit.
export const loadCatchUpDigest = async ({ shareId, drawing, userId, since: requestedSince = null }) => {
    const since = await resolveSince(shareId, userId, requestedSince);
    if (!since) return null;
    const sinceTs = new Date(since).getTime();

    const [persisted, pending] = await Promise.all([queryPersistedOpsSince(shareId, sinceTs), canvasStore.peekPendingOps(shareId)]);
    const persistedSeqs = new Set(persisted.map((op) => op.seq));
    const ops = [...persisted, ...pending.filter((op) => op.ts > sinceTs && !persistedSeqs.has(op.seq))].sort((a, b) => a.seq - b.seq);

    const current = await getLiveOrPersistedElements(shareId, drawing.elements);
    const before = ops.length > 0 ? (await reconstructStateAtSeq(shareId, ops[0].seq - 1)).elements : current;

    let objects = [];
    try {
        ({ objects } = await getGroundedScene(shareId, current));
    } catch (error) {
        logger.warn({ err: error, shareId }, "catch-up couldn't group changes into objects, listing them singly");
    }

    const { rows: comments } = await Comment.find({ shareId });
    const names = await userNamesFor([...new Set(ops.map((op) => op.authorId).filter((authorId) => authorId !== userId))]);

    return buildCatchUpDigest({
        viewerId: userId,
        since: new Date(sinceTs).toISOString(),
        ops,
        before,
        current,
        objects,
        comments,
        nameOfUser: (authorId) => names.get(authorId) ?? "Someone",
        classifyChange,
        getBounds: getElementBounds,
        truncated: persisted.length === MAX_OPS,
    });
};
