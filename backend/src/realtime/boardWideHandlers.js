import { appendOp, diffToRestore } from "../services/operationLog.js";
import { clearBoardSchema, restoreVersionSchema } from "../validation/socketSchemas.js";
import { ROLES } from "../models/accessControl.js";
import safeHandler from "../http/middlewares/safeHandler.js";
import { recordOp, recordRoomOp } from "../observability/metrics.js";
import { canEdit, parsePayload } from "./payloads.js";
import { boardAndWatchers } from "./roomNames.js";

// The two changes that touch a whole board at once, restoring a version and
// clearing it, each applied element by element so both stay undoable.
export const createBoardWideHandlers =
    ({ io, canvasStore }) =>
    (socket) => {
        // A restore is applied as ordinary attributed, logged mutations of the diff, so it stays
        // undoable and the requester can treat it as one batch undo entry.
        socket.on(
            "client:restoreVersion",
            safeHandler(socket, "client:restoreVersion", async (payload) => {
                const parsed = parsePayload(restoreVersionSchema, socket, "client:restoreVersion", payload);
                if (!parsed) return;
                const { shareId, seq } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canEdit(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const { elementOps, background } = await diffToRestore(shareId, seq);

                for (const { elementId, before, after } of elementOps) {
                    if (after === null) {
                        const { version } = await canvasStore.deleteElement(shareId, elementId);
                        io.to(boardAndWatchers(shareId)).emit("server:deleteElement", { elementId, version });
                        await appendOp({ shareId, opType: "delete", elementId, after: null, authorId: socket.userId, authorName: participant.name });
                    } else {
                        const { element: stamped } = await canvasStore.setElement(shareId, elementId, after, socket.userId);
                        const eventName = before === null ? "server:addNewElement" : "server:updateElement";
                        io.to(boardAndWatchers(shareId)).emit(eventName, { elementId, element: stamped });
                        await appendOp({
                            shareId,
                            opType: before === null ? "insert" : "update",
                            elementId,
                            after: stamped,
                            authorId: socket.userId,
                            authorName: participant.name,
                        });
                    }
                    recordOp();
                    recordRoomOp(shareId);
                }

                // Background changes aren't undoable anywhere, including here.
                if (background !== null) {
                    await canvasStore.setBackground(shareId, background);
                    io.to(boardAndWatchers(shareId)).emit("server:backgroundUpdated", { background });
                    await appendOp({
                        shareId,
                        opType: "background",
                        elementId: null,
                        after: background,
                        authorId: socket.userId,
                        authorName: participant.name,
                    });
                    recordOp();
                    recordRoomOp(shareId);
                }

                if (elementOps.length > 0 || background !== null) {
                    await canvasStore.markDirty(shareId);
                }

                socket.emit("server:versionRestored", { shareId, seq, elementOps });
            }),
        );

        // Owner only. Deletes go through the per-element path, so a clear is undoable and in history.
        socket.on(
            "client:clearBoard",
            safeHandler(socket, "client:clearBoard", async (payload) => {
                const parsed = parsePayload(clearBoardSchema, socket, "client:clearBoard", payload);
                if (!parsed) return;
                const { shareId } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || participant.role !== ROLES.OWNER) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const elements = await canvasStore.getElements(shareId);
                const elementOps = [];

                for (const [elementId, before] of Object.entries(elements)) {
                    const { version } = await canvasStore.deleteElement(shareId, elementId);
                    io.to(boardAndWatchers(shareId)).emit("server:deleteElement", { elementId, version });
                    await appendOp({ shareId, opType: "delete", elementId, after: null, authorId: socket.userId, authorName: participant.name });
                    elementOps.push({ elementId, before, after: null });
                    recordOp();
                    recordRoomOp(shareId);
                }

                if (elementOps.length > 0) {
                    await canvasStore.markDirty(shareId);
                }

                socket.emit("server:boardCleared", { shareId, elementOps });
            }),
        );
    };
