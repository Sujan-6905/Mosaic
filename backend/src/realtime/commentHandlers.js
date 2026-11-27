import {
    createComment,
    addReply as addCommentReply,
    setCommentResolved,
    markCommentRead,
    moveComment,
    deleteComment,
    findComment,
    findMentionedUserIds,
} from "../services/comments.js";
import { getBoardTitle, getCollaboratorUserIds, getCollaboratorUsernames } from "../services/boards.js";
import { notify } from "../services/notifications.js";
import {
    addCommentSchema,
    addCommentReplySchema,
    resolveCommentSchema,
    markCommentReadSchema,
    moveCommentSchema,
    deleteCommentSchema,
} from "../validation/socketSchemas.js";
import { ROLES } from "../models/accessControl.js";
import safeHandler from "../http/middlewares/safeHandler.js";
import { canComment, parsePayload } from "./payloads.js";

// Comment threads over the room's socket: who may comment, mentions, and the
// broadcast every change makes to everyone on the board.
export const createCommentHandlers = ({ io, canvasStore }) => {
    // Keeps only real collaborators (or the owner). The text is checked too: a comment sent
    // before the client loaded its collaborator list matched no names.
    const resolveMentions = async (shareId, userIds, text) => {
        if (!userIds?.length && !text?.includes("@")) return [];
        const collaboratorIds = await getCollaboratorUserIds(shareId);
        const fromClient = (userIds ?? []).filter((userId) => collaboratorIds.has(userId));
        const fromText = text?.includes("@") ? findMentionedUserIds(text, await getCollaboratorUsernames(collaboratorIds)) : [];
        return [...new Set([...fromClient, ...fromText])];
    };

    // Someone looking at this board hears about it there and then; everyone
    // mentioned also gets it in their inbox, wherever they are.
    const notifyMentioned = async (shareId, mentionedUserIds, { commentId, authorId, authorName, text }) => {
        const mentioned = mentionedUserIds.filter((userId) => userId !== authorId);
        if (!mentioned.length) return;
        const preview = text.slice(0, 140);
        const participants = await canvasStore.getParticipants(shareId);
        participants
            .filter((participant) => mentioned.includes(participant.userId))
            .forEach((participant) => {
                io.to(participant.socketId).emit("server:mentioned", { shareId, commentId, authorName, preview });
            });
        const boardTitle = (await getBoardTitle(shareId)) ?? "a board";
        await Promise.all(
            mentioned.map((userId) =>
                notify(userId, { kind: "mention", shareId, boardTitle, actorId: authorId, actorName: authorName, preview, commentId }, { io }),
            ),
        );
    };

    // A comment id arrives from the client, so it must name a thread on the
    // board this socket is in, or another board's thread would leak into this room.
    const isOnBoard = async (commentId, shareId) => (await findComment(commentId))?.shareId === shareId;

    return (socket) => {
        // Commenters and above. Comments persist in their own collection, outliving the room.
        socket.on(
            "client:addComment",
            safeHandler(socket, "client:addComment", async (payload) => {
                const parsed = parsePayload(addCommentSchema, socket, "client:addComment", payload);
                if (!parsed) return;
                const { shareId, anchor, text, mentions } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canComment(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const validMentions = await resolveMentions(shareId, mentions, text);
                const comment = await createComment({
                    shareId,
                    anchorType: anchor.type,
                    x: anchor.type === "point" ? anchor.x : null,
                    y: anchor.type === "point" ? anchor.y : null,
                    elementId: anchor.type === "element" ? anchor.elementId : null,
                    authorId: socket.userId,
                    authorName: participant.name,
                    text,
                    mentions: validMentions,
                });
                if (!comment) return;

                io.to(shareId).emit("server:commentAdded", comment);
                await notifyMentioned(shareId, validMentions, {
                    commentId: comment._id,
                    authorId: socket.userId,
                    authorName: participant.name,
                    text,
                });
            }),
        );

        socket.on(
            "client:addCommentReply",
            safeHandler(socket, "client:addCommentReply", async (payload) => {
                const parsed = parsePayload(addCommentReplySchema, socket, "client:addCommentReply", payload);
                if (!parsed) return;
                const { shareId, commentId, text, mentions } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canComment(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                if (!(await isOnBoard(commentId, shareId))) return;
                const validMentions = await resolveMentions(shareId, mentions, text);
                const comment = await addCommentReply({
                    commentId,
                    authorId: socket.userId,
                    authorName: participant.name,
                    text,
                    mentions: validMentions,
                });
                if (!comment) return;

                io.to(shareId).emit("server:commentUpdated", comment);
                await notifyMentioned(shareId, validMentions, {
                    commentId: comment._id,
                    authorId: socket.userId,
                    authorName: participant.name,
                    text,
                });
            }),
        );

        // Resolving only hides a thread; it is never deleted.
        socket.on(
            "client:resolveComment",
            safeHandler(socket, "client:resolveComment", async (payload) => {
                const parsed = parsePayload(resolveCommentSchema, socket, "client:resolveComment", payload);
                if (!parsed) return;
                const { shareId, commentId, resolved } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canComment(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                if (!(await isOnBoard(commentId, shareId))) return;
                const comment = await setCommentResolved({ commentId, resolved });
                if (!comment) return;

                io.to(shareId).emit("server:commentUpdated", comment);
            }),
        );

        // Only the author or the owner may move a pin, the same pair who may delete it.
        socket.on(
            "client:moveComment",
            safeHandler(socket, "client:moveComment", async (payload) => {
                const parsed = parsePayload(moveCommentSchema, socket, "client:moveComment", payload);
                if (!parsed) return;
                const { shareId, commentId, anchor } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canComment(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const existing = await findComment(commentId);
                if (!existing || existing.shareId !== shareId) return;
                if (existing.authorId !== socket.userId && participant.role !== ROLES.OWNER) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const comment = await moveComment({
                    commentId,
                    anchorType: anchor.type,
                    x: anchor.type === "point" ? anchor.x : null,
                    y: anchor.type === "point" ? anchor.y : null,
                    elementId: anchor.type === "element" ? anchor.elementId : null,
                });
                if (!comment) return;

                io.to(shareId).emit("server:commentUpdated", comment);
            }),
        );

        // A real delete, for a stray pin; only the author or the owner.
        socket.on(
            "client:deleteComment",
            safeHandler(socket, "client:deleteComment", async (payload) => {
                const parsed = parsePayload(deleteCommentSchema, socket, "client:deleteComment", payload);
                if (!parsed) return;
                const { shareId, commentId } = parsed;

                if (!socket.rooms.has(shareId)) {
                    socket.emit("server:canvasNotFound");
                    return;
                }

                const participant = await canvasStore.getParticipant(shareId, socket.id);
                if (!participant || !canComment(participant.role)) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const existing = await findComment(commentId);
                if (!existing || existing.shareId !== shareId) return;
                if (existing.authorId !== socket.userId && participant.role !== ROLES.OWNER) {
                    socket.emit("server:canvasAccessDenied");
                    return;
                }

                const deleted = await deleteComment(commentId);
                if (!deleted) return;

                io.to(shareId).emit("server:commentDeleted", { shareId, commentId });
            }),
        );

        // Anyone in the room, viewers included: a read marker changes nothing on the board.
        socket.on(
            "client:markCommentRead",
            safeHandler(socket, "client:markCommentRead", async (payload) => {
                const parsed = parsePayload(markCommentReadSchema, socket, "client:markCommentRead", payload);
                if (!parsed) return;
                const { shareId, commentId } = parsed;

                if (!socket.rooms.has(shareId) || !(await isOnBoard(commentId, shareId))) return;

                const comment = await markCommentRead({ commentId, userId: socket.userId });
                if (!comment) return;

                io.to(shareId).emit("server:commentUpdated", comment);
            }),
        );
    };
};
