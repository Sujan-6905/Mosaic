import { getDefaultInstance } from "ottoman";
import Notification from "../models/notificationSchema.js";
import { getIo } from "../realtime/ioRegistry.js";
import logger from "../observability/logger.js";
import { mentionMessage, pushToUser } from "./webPush.js";

const LIST_LIMIT = 30;
const UNREAD = "(n.readAt IS MISSING OR n.readAt IS NULL)";
const keyspace = () => `\`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`notifications\``;

// Every open connection a person has, on any board or none.
export const userRoom = (userId) => `user:${userId}`;

const publicView = ({ _id, kind, shareId, boardTitle, actorName, preview, commentId, readAt, createdAt }) => ({
    id: _id,
    kind,
    shareId,
    boardTitle: boardTitle ?? null,
    actorName: actorName ?? null,
    preview: preview ?? null,
    commentId: commentId ?? null,
    read: Boolean(readAt),
    createdAt,
});

// Read from socket.data, which every instance sees for a socket on another one.
const isOnBoard = async (io, shareId, userId) => (await io.in(shareId).fetchSockets()).some((socket) => socket.data.principal?.userId === userId);

// Someone already looking at the board sees the mention there; anyone else hears about it on their devices.
const pushMention = async (userId, notice, io) => {
    try {
        if (io && (await isOnBoard(io, notice.shareId, userId))) return;
        await pushToUser(userId, mentionMessage(notice));
    } catch (error) {
        logger.warn({ err: error, shareId: notice.shareId }, "couldn't push a mention");
    }
};

// A notice is a nicety: failing to store or push one never fails what caused it.
export const notify = async (userId, notice, { io = getIo() } = {}) => {
    try {
        const created = await Notification.create({ userId, ...notice });
        io?.to(userRoom(userId)).emit("server:notification", publicView(created));
        if (notice.kind === "mention") void pushMention(userId, notice, io);
        return created;
    } catch (error) {
        logger.warn({ err: error, kind: notice.kind, shareId: notice.shareId }, "couldn't record a notification");
        return null;
    }
};

export const listNotifications = async (userId) => {
    const ottoman = getDefaultInstance();
    const [
        { rows },
        {
            rows: [{ unread } = { unread: 0 }],
        },
    ] = await Promise.all([
        ottoman.query(`SELECT n.*, META(n).id AS _id FROM ${keyspace()} AS n WHERE n.userId = $userId ORDER BY n.createdAt DESC LIMIT ${LIST_LIMIT}`, {
            parameters: { userId },
        }),
        ottoman.query(`SELECT COUNT(*) AS unread FROM ${keyspace()} AS n WHERE n.userId = $userId AND ${UNREAD}`, { parameters: { userId } }),
    ]);
    return { notifications: rows.map((row) => publicView({ ...row, _id: row._id.replace(/^Notification::/, "") })), unread };
};

// `ids` omitted marks everything read.
export const markNotificationsRead = async (userId, ids = null) => {
    await getDefaultInstance().query(
        `UPDATE ${keyspace()} AS n SET n.readAt = $now WHERE n.userId = $userId AND ${UNREAD}${ids ? " AND META(n).id IN $keys" : ""}`,
        { parameters: { userId, now: new Date().toISOString(), ...(ids ? { keys: ids.map((id) => `Notification::${id}`) } : {}) } },
    );
};

// Whether this person already asked for this board in the last day and hasn't been answered.
export const hasPendingRequest = async (ownerId, actorId, shareId) => {
    const { rows } = await getDefaultInstance().query(
        `SELECT RAW COUNT(*) FROM ${keyspace()} AS n
         WHERE n.userId = $ownerId AND n.kind = "accessRequest" AND n.actorId = $actorId AND n.shareId = $shareId AND n.createdAt > $since`,
        { parameters: { ownerId, actorId, shareId, since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } },
    );
    return rows[0] > 0;
};
