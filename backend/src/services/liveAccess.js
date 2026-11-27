import canvasStore from "../liveRooms/canvasStore.js";
import { getIo } from "../realtime/ioRegistry.js";
import { WATCH_ROLES, getRole } from "../models/accessControl.js";
import { WATCH_KINDS, watchRoom } from "../realtime/roomNames.js";

export const broadcastPresence = async (io, store, shareId) => {
    const participants = await store.getParticipants(shareId);
    io.to(shareId).emit(
        "server:presenceUpdate",
        participants.map(({ socketId, userId, name, color, role, via }) => ({ socketId, userId, name, color, role, via: via ?? null })),
    );
};

// Applies a board's current access rules to every open connection, so a revoke or a
// demotion holds at once on the server instead of waiting for the client to re-join.
export const enforceLiveAccess = async (drawing, { io = getIo(), store = canvasStore } = {}) => {
    if (!io) return;
    const { shareId } = drawing;
    const boardSockets = await io.in(shareId).fetchSockets();

    let presenceChanged = false;
    for (const socket of boardSockets) {
        const participant = await store.getParticipant(shareId, socket.id);
        if (!participant) continue;
        const role = getRole(drawing, socket.data.principal);
        if (role === participant.role) continue;
        presenceChanged = true;
        if (role) {
            await store.addParticipant(shareId, socket.id, { ...participant, role });
            socket.emit("server:roleChanged", { shareId });
        } else {
            socket.leave(shareId);
            await store.removeParticipant(shareId, socket.id);
            socket.emit("server:accessRevoked", { shareId });
        }
    }

    for (const via of WATCH_KINDS) {
        for (const socket of await io.in(watchRoom(shareId, via)).fetchSockets()) {
            if (WATCH_ROLES[via](drawing, socket.data.principal)) continue;
            socket.leave(watchRoom(shareId, via));
            socket.emit("watch:refused");
        }
    }

    if (presenceChanged) await broadcastPresence(io, store, shareId);
};
