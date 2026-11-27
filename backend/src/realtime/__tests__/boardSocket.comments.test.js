import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";

// The socket layer reaches Couchbase only through these exports; every board is joinable
// and editable unless a test overrides it.
vi.mock("../../services/notifications.js", () => ({ notify: vi.fn().mockResolvedValue(null), userRoom: (userId) => `user:${userId}` }));
vi.mock("../../services/boards.js", () => ({
    getBoardTitle: vi.fn().mockResolvedValue("Board"),
    SAVE_RESULT: { SAVED: "saved", BOARD_GONE: "board-gone", FAILED: "failed", NOTHING_TO_SAVE: "nothing-to-save" },
    saveCanvasToDB: vi.fn().mockResolvedValue("saved"),
    closeLiveRoom: vi.fn(),
    loadDataFromDB: vi.fn().mockResolvedValue({}),
    getAccessForShareId: vi.fn(),
    getCollaboratorUserIds: vi.fn(),
    getCollaboratorUsernames: vi.fn().mockResolvedValue(new Map()),
    recordLastSeen: vi.fn().mockResolvedValue(undefined),
    getUsername: vi.fn(async (userId) => `name-of-${userId}`),
}));

// Mocked documents close enough for the broadcast and notify logic to run unchanged.
vi.mock("../../services/comments.js", () => ({
    findMentionedUserIds: vi.fn(() => []),
    createComment: vi.fn(),
    addReply: vi.fn(),
    setCommentResolved: vi.fn(),
    markCommentRead: vi.fn(),
    getCommentsForShareId: vi.fn().mockResolvedValue([]),
    moveComment: vi.fn(),
    deleteComment: vi.fn(),
    findComment: vi.fn(),
}));

// The op-log models import the database connection, so they're mocked too.
vi.mock("../../services/operationLog.js", () => ({
    appendOp: vi.fn().mockResolvedValue(1),
    flushOperationLog: vi.fn().mockResolvedValue(undefined),
    diffToRestore: vi.fn(),
    getLatestSeq: vi.fn().mockResolvedValue(0),
}));

// Search indexing during a flush uses the models directly.
vi.mock("../../search/indexBoard.js", () => ({
    indexBoardForSearchSafely: vi.fn().mockResolvedValue(undefined),
}));

const { getAccessForShareId, getCollaboratorUserIds } = await import("../../services/boards.js");
const { createComment, addReply, setCommentResolved, markCommentRead, moveComment, deleteComment, findComment } = await import("../../services/comments.js");
const { appendOp, diffToRestore } = await import("../../services/operationLog.js");
const socketLogic = (await import("../boardSocket.js")).default;

let httpServer;
let io;
let port;

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);

const connectClient = (userId) =>
    new Promise((resolve, reject) => {
        const client = ioClient(`http://localhost:${port}`, {
            auth: { token: signToken(userId) },
            transports: ["websocket"],
            forceNew: true,
        });
        client.once("connect", () => resolve(client));
        client.once("connect_error", reject);
    });

const waitFor = (client, event) => new Promise((resolve) => client.once(event, resolve));

beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: "*" } });
    socketLogic(io);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
});

afterAll(() => {
    io.close();
    httpServer.close();
});

beforeEach(() => {
    // Each test starts from "board exists, caller can edit".
    getAccessForShareId.mockReset();
    getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });

    getCollaboratorUserIds.mockReset();
    getCollaboratorUserIds.mockResolvedValue(new Set());

    createComment.mockReset();
    addReply.mockReset();
    setCommentResolved.mockReset();
    markCommentRead.mockReset();
    moveComment.mockReset();
    deleteComment.mockReset();
    findComment.mockReset();

    appendOp.mockReset();
    appendOp.mockResolvedValue(1);
    diffToRestore.mockReset();
});

describe("client:addComment", () => {
    it("denies a viewer's attempt to comment", async () => {
        const shareId = "board-comment-denied";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });
        const client = await connectClient("userK");
        client.emit("client:joinRoom", { shareId, name: "K" });
        await waitFor(client, "server:joinedRoom");

        const denied = waitFor(client, "server:canvasAccessDenied");
        client.emit("client:addComment", {
            shareId,
            anchor: { type: "point", x: 5, y: 5 },
            text: "nice work",
        });
        await denied;
        expect(createComment).not.toHaveBeenCalled();

        client.close();
    });

    it("lets a commenter add a comment and broadcasts it to the room", async () => {
        const shareId = "board-comment-added";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "commenter" });
        createComment.mockResolvedValue({ _id: "comment-1", shareId, text: "nice work" });

        const client = await connectClient("userL");
        client.emit("client:joinRoom", { shareId, name: "L" });
        await waitFor(client, "server:joinedRoom");

        const added = waitFor(client, "server:commentAdded");
        client.emit("client:addComment", {
            shareId,
            anchor: { type: "point", x: 5, y: 5 },
            text: "nice work",
        });
        const payload = await added;

        expect(payload).toMatchObject({ _id: "comment-1", text: "nice work" });
        expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ shareId, anchorType: "point", x: 5, y: 5, elementId: null, text: "nice work" }));

        client.close();
    });

    it("only notifies a mentioned user who is a real collaborator, and never the author themself", async () => {
        const shareId = "board-comment-mentions";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        getCollaboratorUserIds.mockResolvedValue(new Set(["userN", "userO"]));
        createComment.mockResolvedValue({ _id: "comment-2", shareId, text: "hey @N @intruder" });

        const clientAuthor = await connectClient("userM");
        clientAuthor.emit("client:joinRoom", { shareId, name: "M" });
        await waitFor(clientAuthor, "server:joinedRoom");

        const clientMentioned = await connectClient("userN");
        clientMentioned.emit("client:joinRoom", { shareId, name: "N" });
        await waitFor(clientMentioned, "server:joinedRoom");

        // Both dropped before notifying: the author mentioned themself, the other isn't a collaborator.
        const mentioned = waitFor(clientMentioned, "server:mentioned");
        const authorMentioned = [];
        clientAuthor.on("server:mentioned", (p) => authorMentioned.push(p));

        clientAuthor.emit("client:addComment", {
            shareId,
            anchor: { type: "point", x: 0, y: 0 },
            text: "hey @N @intruder",
            mentions: ["userN", "userM", "not-a-collaborator"],
        });

        const payload = await mentioned;
        expect(payload).toMatchObject({ shareId, commentId: "comment-2", authorName: "name-of-userM" });
        expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ mentions: ["userN"] }));
        expect(authorMentioned).toHaveLength(0);

        clientAuthor.close();
        clientMentioned.close();
    });
});

describe("client:addCommentReply / client:resolveComment / client:markCommentRead", () => {
    it("broadcasts a reply to the room as server:commentUpdated", async () => {
        const shareId = "board-comment-reply";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "commenter" });
        findComment.mockResolvedValue({ _id: "comment-3", shareId });
        addReply.mockResolvedValue({ _id: "comment-3", shareId, replies: [{ id: "r1", text: "+1" }] });

        const client = await connectClient("userP");
        client.emit("client:joinRoom", { shareId, name: "P" });
        await waitFor(client, "server:joinedRoom");

        const updated = waitFor(client, "server:commentUpdated");
        client.emit("client:addCommentReply", { shareId, commentId: "comment-3", text: "+1" });
        const payload = await updated;

        expect(payload.replies).toEqual([{ id: "r1", text: "+1" }]);

        client.close();
    });

    it("resolving never removes the thread - it only flips the resolved flag broadcast to the room", async () => {
        const shareId = "board-comment-resolve";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        findComment.mockResolvedValue({ _id: "comment-4", shareId });
        setCommentResolved.mockResolvedValue({ _id: "comment-4", shareId, resolved: true });

        const client = await connectClient("userQ");
        client.emit("client:joinRoom", { shareId, name: "Q" });
        await waitFor(client, "server:joinedRoom");

        const updated = waitFor(client, "server:commentUpdated");
        client.emit("client:resolveComment", { shareId, commentId: "comment-4", resolved: true });
        const payload = await updated;

        expect(payload.resolved).toBe(true);
        expect(setCommentResolved).toHaveBeenCalledWith({ commentId: "comment-4", resolved: true });

        client.close();
    });

    it("lets a viewer mark a comment read - acknowledging a thread isn't a board mutation", async () => {
        const shareId = "board-comment-read";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });
        findComment.mockResolvedValue({ _id: "comment-5", shareId });
        markCommentRead.mockResolvedValue({ _id: "comment-5", shareId, readBy: ["userR"] });

        const client = await connectClient("userR");
        client.emit("client:joinRoom", { shareId, name: "R" });
        await waitFor(client, "server:joinedRoom");

        const updated = waitFor(client, "server:commentUpdated");
        client.emit("client:markCommentRead", { shareId, commentId: "comment-5" });
        const payload = await updated;

        expect(payload.readBy).toEqual(["userR"]);

        client.close();
    });

    it("ignores a reply, resolve or read aimed at another board's comment", async () => {
        const shareId = "board-comment-own";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        findComment.mockResolvedValue({ _id: "comment-elsewhere", shareId: "some-other-board" });

        const client = await connectClient("userW");
        client.emit("client:joinRoom", { shareId, name: "W" });
        await waitFor(client, "server:joinedRoom");

        const leaked = [];
        client.on("server:commentUpdated", (payload) => leaked.push(payload));
        client.emit("client:addCommentReply", { shareId, commentId: "comment-elsewhere", text: "hi" });
        client.emit("client:resolveComment", { shareId, commentId: "comment-elsewhere", resolved: true });
        client.emit("client:markCommentRead", { shareId, commentId: "comment-elsewhere" });
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(leaked).toEqual([]);
        expect(addReply).not.toHaveBeenCalled();
        expect(setCommentResolved).not.toHaveBeenCalled();
        expect(markCommentRead).not.toHaveBeenCalled();

        client.close();
    });
});

describe("client:moveComment / client:deleteComment", () => {
    it("lets the comment's own author move it, even without edit access", async () => {
        const shareId = "board-comment-move";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "commenter" });
        findComment.mockResolvedValue({ _id: "comment-6", shareId, authorId: "userU" });
        moveComment.mockResolvedValue({ _id: "comment-6", shareId, anchorType: "point", x: 9, y: 9 });

        const client = await connectClient("userU");
        client.emit("client:joinRoom", { shareId, name: "U" });
        await waitFor(client, "server:joinedRoom");

        const updated = waitFor(client, "server:commentUpdated");
        client.emit("client:moveComment", { shareId, commentId: "comment-6", anchor: { type: "point", x: 9, y: 9 } });
        const payload = await updated;

        expect(payload).toMatchObject({ x: 9, y: 9 });
        expect(moveComment).toHaveBeenCalledWith({ commentId: "comment-6", anchorType: "point", x: 9, y: 9, elementId: null });

        client.close();
    });

    it("denies moving someone else's comment when the requester is neither its author nor the board owner", async () => {
        const shareId = "board-comment-move-denied";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        findComment.mockResolvedValue({ _id: "comment-7", shareId, authorId: "userV" });

        const client = await connectClient("userW");
        client.emit("client:joinRoom", { shareId, name: "W" });
        await waitFor(client, "server:joinedRoom");

        const denied = waitFor(client, "server:canvasAccessDenied");
        client.emit("client:moveComment", { shareId, commentId: "comment-7", anchor: { type: "point", x: 1, y: 1 } });
        await denied;
        expect(moveComment).not.toHaveBeenCalled();

        client.close();
    });

    it("lets the board owner delete someone else's comment and broadcasts the removal", async () => {
        const shareId = "board-comment-delete";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "owner" });
        findComment.mockResolvedValue({ _id: "comment-8", shareId, authorId: "userX" });
        deleteComment.mockResolvedValue({ _id: "comment-8", shareId });

        const client = await connectClient("userY");
        client.emit("client:joinRoom", { shareId, name: "Y" });
        await waitFor(client, "server:joinedRoom");

        const removed = waitFor(client, "server:commentDeleted");
        client.emit("client:deleteComment", { shareId, commentId: "comment-8" });
        const payload = await removed;

        expect(payload).toEqual({ shareId, commentId: "comment-8" });
        expect(deleteComment).toHaveBeenCalledWith("comment-8");

        client.close();
    });
});
