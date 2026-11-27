import { ROLES, hasAtLeastRank } from "../models/accessControl.js";

// Drops (and logs) any invalid payload before it reaches room state or the database.
export const parsePayload = (schema, socket, eventName, payload) => {
    const result = schema.safeParse(payload);
    if (!result.success) {
        socket.log.warn({ event: eventName, issues: result.error.issues }, "dropped invalid payload");
        return null;
    }
    return result.data;
};

export const canEdit = (role) => hasAtLeastRank(role, ROLES.EDITOR);
export const canComment = (role) => hasAtLeastRank(role, ROLES.COMMENTER);

// Puts the sender's copy of an element back to what the room holds, so a refused change
// never lingers on one screen while everyone else and the saved board go without it.
export const rejectElementChange = async (socket, canvasStore, payload, reason) => {
    const shareId = typeof payload?.shareId === "string" ? payload.shareId : null;
    const elementId = typeof payload?.elementId === "string" ? payload.elementId : null;
    if (!shareId || !elementId || !socket.rooms.has(shareId)) return;
    const element = await canvasStore.getElement(shareId, elementId);
    socket.emit("server:elementRejected", { elementId, element, reason });
};
