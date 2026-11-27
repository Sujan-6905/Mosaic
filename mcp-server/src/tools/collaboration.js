import { z } from "zod";
import { json, shareIdField } from "./common.js";

const commentSummary = (comment) => ({
    id: comment._id,
    anchor: comment.anchorType === "element" ? { elementId: comment.elementId } : { x: comment.x, y: comment.y },
    author: comment.authorName,
    text: comment.text,
    resolved: Boolean(comment.resolved),
    replies: (comment.replies ?? []).map((reply) => ({ author: reply.authorName, text: reply.text, createdAt: reply.createdAt })),
    createdAt: comment.createdAt,
});

const commentIdField = z.string().min(1).describe("A comment thread's id, from list_comments");

export const registerCollaborationTools = (server, { boards }) => {
    server.registerTool(
        "list_comments",
        {
            title: "List comments",
            description: "Read a board's comment threads with their replies, live. Each is pinned to a point or to an element.",
            inputSchema: { shareId: shareIdField, includeResolved: z.boolean().optional().describe("Include resolved threads; defaults to false") },
        },
        async ({ shareId, includeResolved = false }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            const threads = [...session.comments.values()].filter((comment) => includeResolved || !comment.resolved);
            return json(threads.map(commentSummary));
        },
    );

    server.registerTool(
        "add_comment",
        {
            title: "Add comment",
            description:
                "Start a comment thread on a board, pinned to an element (it follows the element as it moves) or to a point. Collaborators see it appear live.",
            inputSchema: {
                shareId: shareIdField,
                text: z.string().min(1).max(2000),
                elementId: z.string().optional().describe("Pin to this element"),
                x: z.number().optional().describe("Pin to this point when no elementId is given"),
                y: z.number().optional(),
            },
        },
        async ({ shareId, text, elementId, x, y }) => {
            if (!elementId && (x === undefined || y === undefined)) throw new Error("Give an elementId, or both x and y");
            const anchor = elementId ? { type: "element", elementId } : { type: "point", x, y };
            return json(commentSummary(await boards.get(shareId).addComment(anchor, text)));
        },
    );

    server.registerTool(
        "reply_to_comment",
        {
            title: "Reply to comment",
            description: "Add a reply to an existing comment thread.",
            inputSchema: { shareId: shareIdField, commentId: commentIdField, text: z.string().min(1).max(2000) },
        },
        async ({ shareId, commentId, text }) => json(commentSummary(await boards.get(shareId).replyToComment(commentId, text))),
    );

    server.registerTool(
        "resolve_comment",
        {
            title: "Resolve comment",
            description: "Mark a comment thread resolved, or reopen it with resolved: false.",
            inputSchema: { shareId: shareIdField, commentId: commentIdField, resolved: z.boolean().optional().describe("Defaults to true") },
        },
        async ({ shareId, commentId, resolved = true }) => json(commentSummary(await boards.get(shareId).resolveComment(commentId, resolved))),
    );

    server.registerTool(
        "delete_comment",
        {
            title: "Delete comment",
            description: "Delete a comment thread. Allowed for the thread's author and the board's owner.",
            inputSchema: { shareId: shareIdField, commentId: commentIdField },
        },
        async ({ shareId, commentId }) => {
            await boards.get(shareId).deleteComment(commentId);
            return json({ deleted: commentId });
        },
    );

    server.registerTool(
        "who_is_here",
        {
            title: "Who is on the board",
            description: 'List everyone in the board right now, with their name, role and presence colour. This agent appears as "AI Agent".',
            inputSchema: { shareId: shareIdField },
        },
        async ({ shareId }) => {
            const participants = await boards.get(shareId).listParticipants();
            return json(participants.map(({ name, role, color, userId }) => ({ name, role, color, userId })));
        },
    );

    server.registerTool(
        "point_at",
        {
            title: "Point at a spot",
            description: "Move this agent's live cursor to a point on the board, so the people there can see where it is working or what it is talking about.",
            inputSchema: { shareId: shareIdField, x: z.number(), y: z.number() },
        },
        async ({ shareId, x, y }) => {
            await boards.get(shareId).moveCursor(x, y);
            return json({ pointingAt: { x, y } });
        },
    );
};
