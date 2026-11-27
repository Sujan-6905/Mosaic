import { findDrawingByShareId } from "../services/boards.js";
import safeHandler from "../http/middlewares/safeHandler.js";
import { getLiveOrPersistedScene } from "../liveRooms/liveScene.js";
import { WATCH_ROLES } from "../models/accessControl.js";
import { watchRoom } from "./roomNames.js";

const SHARE_ID = /^[A-Za-z0-9_-]{1,40}$/;
// Past this many live viewers of one board on one instance, a new viewer gets
// a snapshot refreshed on a timer instead of a live connection.
const liveViewerCap = () => Number(process.env.EMBED_LIVE_VIEWER_CAP) || 1000;
const JOIN_READ_WINDOW_MS = 25;
const pendingReads = new Map();

// Joins that land together share one read of the board, and the read starts
// only once all of them have joined, so a crowd arriving at once costs one read.
const readAfterJoining = (drawing) => {
    let pending = pendingReads.get(drawing.shareId);
    if (!pending) {
        pending = new Promise((resolve) => setTimeout(resolve, JOIN_READ_WINDOW_MS)).then(() => {
            pendingReads.delete(drawing.shareId);
            return getLiveOrPersistedScene(drawing);
        });
        pendingReads.set(drawing.shareId, pending);
    }
    return pending;
};

// A watcher joins the embed or link room, which carries changes but never presence, and gets
// the board as of joining since its first load can be seconds old.
export const registerWatchHandlers = (socket, io) => {
    socket.on(
        "watch:start",
        safeHandler(socket, "watch:start", async (payload) => {
            const shareId = typeof payload?.shareId === "string" && SHARE_ID.test(payload.shareId) ? payload.shareId : null;
            const via = Object.hasOwn(WATCH_ROLES, payload?.via) ? payload.via : null;
            if (!shareId || !via) return;
            const room = watchRoom(shareId, via);
            if (socket.rooms?.has(room)) return;
            const drawing = await findDrawingByShareId(shareId);
            if (!drawing || !WATCH_ROLES[via](drawing, socket.principal)) {
                socket.emit("watch:refused");
                return;
            }
            if ((io.sockets.adapter.rooms.get(room)?.size ?? 0) >= liveViewerCap()) {
                socket.emit("watch:snapshotOnly");
                return;
            }
            socket.join(room);
            // Read after joining: a change made before the read is in it, one made after arrives as an event.
            const { elements, background } = await readAfterJoining(drawing);
            socket.emit("watch:live", { elements: elements ?? {}, background });
        }),
    );
};
