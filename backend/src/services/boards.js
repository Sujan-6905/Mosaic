// Board documents and the people on them, shared by REST handlers, live rooms and background work.
import { nullIfMissing } from "../db/errors.js";
import Drawing from "../models/drawingSchema.js";
import User from "../models/userSchema.js";
import BoardVisit from "../models/boardVisitSchema.js";
import { DocumentNotFoundError, SearchConsistency, getDefaultInstance } from "ottoman";
import canvasStore from "../liveRooms/canvasStore.js";
import { getIo } from "../realtime/ioRegistry.js";
import logger from "../observability/logger.js";

const findDrawingByShareId = (shareId) => nullIfMissing(() => Drawing.findOne({ shareId }));

const findUserById = (userId) => nullIfMissing(() => User.findById(userId));

// Containment in a Mixed array can't use a plain index, so this is a raw ANY/SATISFIES query.
const findDrawingsSharedWithUser = async (userId, fields = null) => {
    const ottoman = getDefaultInstance();
    const bucket = process.env.CB_BUCKET_NAME;
    const projection = fields
        ? fields
              .filter((field) => field !== "_id")
              .map((field) => `drawings.${field}`)
              .join(", ")
        : "drawings.*";

    const result = await ottoman.query(
        `SELECT ${projection}, META(drawings).id AS _id
         FROM \`${bucket}\`.\`app\`.\`drawings\` AS drawings
         WHERE ANY c IN drawings.collaborators SATISFIES c.userId = $userId END
         ORDER BY drawings.createdAt DESC`,
        { parameters: { userId } },
    );

    // Strips the "Drawing::" key prefix the way Ottoman's own find() does.
    return result.rows.map((row) => ({
        ...row,
        _id: row._id.replace(/^Drawing::/, ""),
    }));
};

const SAVE_RESULT = Object.freeze({ SAVED: "saved", BOARD_GONE: "board-gone", FAILED: "failed", NOTHING_TO_SAVE: "nothing-to-save" });

// Never upserts: a miss means the board is gone, so retrying can't succeed.
const saveCanvasToDB = async ({ canvasShareId, canvasElements, canvasBackground }) => {
    try {
        const { _id: drawingId } = await Drawing.findOne({ shareId: canvasShareId }, { select: "_id", consistency: SearchConsistency.LOCAL });
        await Drawing.writeFields(drawingId, { elements: canvasElements, background: canvasBackground });
        return SAVE_RESULT.SAVED;
    } catch (error) {
        if (error instanceof DocumentNotFoundError) {
            logger.warn({ canvasShareId }, "dropping autosave for a board with no drawing");
            return SAVE_RESULT.BOARD_GONE;
        }
        logger.error({ err: error, canvasShareId }, "error saving canvas to DB");
        return SAVE_RESULT.FAILED;
    }
};

// Tells anyone still on a just-deleted board, then drops its room state so
// the autosave sweep has nothing left to flush for it.
const closeLiveRoom = async (shareId, { io = getIo(), store = canvasStore } = {}) => {
    if (io) {
        io.to(shareId).emit("server:boardDeleted", { shareId });
        io.in(shareId).socketsLeave(shareId);
    }
    await store.deleteRoom(shareId);
};

// A mentioned id must be a collaborator or the owner, so a tampered payload can't reach or
// reveal an account without access.
const getCollaboratorUserIds = async (shareId) => {
    const drawing = await findDrawingByShareId(shareId);
    if (!drawing) return new Set();
    return new Set([drawing.owner, ...drawing.collaborators.map((c) => c.userId)]);
};

const getCollaboratorUsernames = async (userIds) => {
    const users = await Promise.all([...userIds].map((userId) => User.findById(userId).catch(() => null)));
    return new Map(users.filter(Boolean).map((user) => [user._id, user.username]));
};

const getUsername = async (userId) => (await User.findById(userId).catch(() => null))?.username ?? null;

const getBoardTitle = async (shareId) => (await findDrawingByShareId(shareId).catch(() => null))?.title ?? null;

// Authorises a socket join and returns the caller's role without exposing the document.
const getAccessForShareId = async (shareId, who) => {
    const drawing = await findDrawingByShareId(shareId);
    return drawing ? { exists: true, role: drawing.getRole(who) } : { exists: false, role: null };
};

// Throws when the database fails rather than returning nothing. A caller seeding a
// live room from an empty result would autosave that emptiness over the real board.
const loadDataFromDB = async (shareId) => {
    const drawing = await findDrawingByShareId(shareId);
    return drawing ? { elements: drawing.elements, background: drawing.background } : undefined;
};

const BOARD_COLLECTIONS = ["boardOrganizations", "boardVisits", "comments", "operationLogs", "snapshots", "searchIndexes", "aiConversations", "letters"];

// Removes everything kept per board; the board itself goes last so a failed delete stays
// listed and can be retried.
const removeBoard = async ({ _id, shareId }) => {
    await closeLiveRoom(shareId);
    const ottoman = getDefaultInstance();
    await Promise.all([
        ...BOARD_COLLECTIONS.map((collection) =>
            ottoman.query(`DELETE FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`${collection}\` WHERE shareId = $shareId`, { parameters: { shareId } }),
        ),
        ottoman.query(`DELETE FROM \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`mergeBases\` WHERE META().id = $key`, {
            parameters: { key: `MergeBase::${shareId}` },
        }),
    ]);
    await Drawing.removeById(_id);
};

// A failure here must never affect leaving a room or opening the Share dialog:
// a last-seen note is a nicety.
const recordLastSeen = async (shareId, userId) => {
    try {
        await BoardVisit.findOneAndUpdate({ shareId, userId }, { shareId, userId, lastSeenAt: new Date().toISOString() }, { upsert: true });
    } catch (error) {
        logger.warn({ err: error, shareId }, "failed to record last seen");
    }
};

export {
    findDrawingByShareId,
    findUserById,
    findDrawingsSharedWithUser,
    SAVE_RESULT,
    saveCanvasToDB,
    closeLiveRoom,
    getCollaboratorUserIds,
    getCollaboratorUsernames,
    getUsername,
    getBoardTitle,
    getAccessForShareId,
    loadDataFromDB,
    removeBoard,
    recordLastSeen,
};
