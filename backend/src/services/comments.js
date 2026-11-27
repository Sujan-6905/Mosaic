import { nullIfMissing } from "../db/errors.js";
import { nanoid } from "nanoid";
import Comment from "../models/commentSchema.js";
import logger from "../observability/logger.js";

const findComment = (commentId) => nullIfMissing(() => Comment.findById(commentId));

const createComment = async ({ shareId, anchorType, x, y, elementId, authorId, authorName, text, mentions }) => {
    try {
        return await Comment.create({
            shareId,
            anchorType,
            x: x ?? null,
            y: y ?? null,
            elementId: elementId ?? null,
            authorId,
            authorName,
            text,
            mentions,
            resolved: false,
            readBy: [authorId],
            replies: [],
        });
    } catch (error) {
        logger.error({ err: error, shareId }, "error creating comment");
        return null;
    }
};

const USERNAME_CHARACTER = /[A-Za-z0-9_-]/;

// Who a comment's text names as @username, among the people given. A longer
// name that merely starts with someone's doesn't count as them.
const findMentionedUserIds = (text, usernameByUserId) => {
    const mentioned = [];
    for (const [userId, username] of usernameByUserId) {
        const token = `@${username}`;
        let at = text.indexOf(token);
        while (at !== -1) {
            if (!USERNAME_CHARACTER.test(text[at + token.length] ?? "")) {
                mentioned.push(userId);
                break;
            }
            at = text.indexOf(token, at + 1);
        }
    }
    return mentioned;
};

const addReply = async ({ commentId, authorId, authorName, text, mentions }) => {
    try {
        const comment = await findComment(commentId);
        if (!comment) return null;

        comment.replies.push({ id: nanoid(12), authorId, authorName, text, mentions, createdAt: Date.now() });
        comment.readBy = [...new Set([...comment.readBy, authorId])];
        await comment.save();
        return comment;
    } catch (error) {
        logger.error({ err: error, commentId }, "error adding reply");
        return null;
    }
};

const setCommentResolved = async ({ commentId, resolved }) => {
    try {
        const comment = await findComment(commentId);
        if (!comment) return null;

        comment.resolved = resolved;
        await comment.save();
        return comment;
    } catch (error) {
        logger.error({ err: error, commentId }, "error resolving comment");
        return null;
    }
};

const markCommentRead = async ({ commentId, userId }) => {
    try {
        const comment = await findComment(commentId);
        if (!comment) return null;

        if (!comment.readBy.includes(userId)) {
            comment.readBy.push(userId);
            await comment.save();
        }
        return comment;
    } catch (error) {
        logger.error({ err: error, commentId }, "error marking comment read");
        return null;
    }
};

const getCommentsForShareId = async (shareId) => {
    try {
        const { rows } = await Comment.find({ shareId }, { sort: { createdAt: "ASC" } });
        return rows;
    } catch (error) {
        logger.error({ err: error, shareId }, "error loading comments");
        return [];
    }
};

// Moves a pin, keeping its thread, using the same anchor shape addComment takes.
const moveComment = async ({ commentId, anchorType, x, y, elementId }) => {
    try {
        const comment = await findComment(commentId);
        if (!comment) return null;

        comment.anchorType = anchorType;
        comment.x = anchorType === "point" ? x : null;
        comment.y = anchorType === "point" ? y : null;
        comment.elementId = anchorType === "element" ? elementId : null;
        await comment.save();
        return comment;
    } catch (error) {
        logger.error({ err: error, commentId }, "error moving comment");
        return null;
    }
};

// A real removal, for a stray pin nobody has replied to; resolving is how threads end.
const deleteComment = async (commentId) => {
    try {
        const comment = await findComment(commentId);
        if (!comment) return null;
        await Comment.removeById(commentId);
        return comment;
    } catch (error) {
        logger.error({ err: error, commentId }, "error deleting comment");
        return null;
    }
};

export { findMentionedUserIds, createComment, addReply, setCommentResolved, markCommentRead, getCommentsForShareId, moveComment, deleteComment, findComment };
