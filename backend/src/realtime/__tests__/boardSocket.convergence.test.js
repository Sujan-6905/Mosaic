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

describe("socket auth", () => {
    it("rejects a connection with no token", async () => {
        const client = ioClient(`http://localhost:${port}`, {
            transports: ["websocket"],
            forceNew: true,
        });
        const error = await new Promise((resolve) => client.once("connect_error", resolve));
        expect(error.message).toBe("unauthorized");
        client.close();
    });

    it("rejects a connection with an invalid token", async () => {
        const client = ioClient(`http://localhost:${port}`, {
            auth: { token: "garbage" },
            transports: ["websocket"],
            forceNew: true,
        });
        const error = await new Promise((resolve) => client.once("connect_error", resolve));
        expect(error.message).toBe("unauthorized");
        client.close();
    });
});

describe("client:joinRoom", () => {
    it("denies a user without edit access", async () => {
        getAccessForShareId.mockResolvedValue({ exists: true, role: null });
        const client = await connectClient("intruder");
        const denied = waitFor(client, "server:canvasAccessDenied");
        client.emit("client:joinRoom", { shareId: "board-denied", name: "Intruder" });
        await denied;
        client.close();
    });

    it("reports canvasNotFound for a shareId that doesn't exist", async () => {
        getAccessForShareId.mockResolvedValue({ exists: false, role: null });
        const client = await connectClient("u1");
        const notFound = waitFor(client, "server:canvasNotFound");
        client.emit("client:joinRoom", { shareId: "board-missing", name: "U1" });
        await notFound;
        client.close();
    });
});

// Two real clients firing conflicting updates at one element must converge on identical
// state through server-stamped versions.
describe("concurrent conflicting updates converge (LWW)", () => {
    it("both clients end up agreeing on the same final version and value for the contested element", async () => {
        const shareId = "board-lww-convergence";
        const clientA = await connectClient("userA");
        const clientB = await connectClient("userB");

        clientA.emit("client:joinRoom", { shareId, name: "A" });
        await waitFor(clientA, "server:joinedRoom");
        clientB.emit("client:joinRoom", { shareId, name: "B" });
        await waitFor(clientB, "server:joinedRoom");

        const elementId = "contested-element";
        const receivedByA = [];
        const receivedByB = [];
        clientA.on("server:addNewElement", (payload) => receivedByA.push(payload));
        clientA.on("server:updateElement", (payload) => receivedByA.push(payload));
        clientB.on("server:addNewElement", (payload) => receivedByB.push(payload));
        clientB.on("server:updateElement", (payload) => receivedByB.push(payload));

        // Both write the same element back to back with no coordination.
        const shapeElement = (color) => ({
            type: "shape",
            shapeType: "Rectangle",
            startX: 0,
            startY: 0,
            endX: 10,
            endY: 10,
            color,
            fillColor: null,
            size: 2,
            opacity: 100,
            zIndex: 1,
            rotation: 0,
        });

        clientA.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId,
            element: shapeElement("red"),
        });
        clientB.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId,
            element: shapeElement("blue"),
        });

        // Both clients should see two broadcasts each (their own write's
        // echo and the other's).
        await vi.waitUntil(() => receivedByA.length >= 2 && receivedByB.length >= 2, { timeout: 2000 });

        const finalForA = receivedByA.filter((e) => e.elementId === elementId).at(-1);
        const finalForB = receivedByB.filter((e) => e.elementId === elementId).at(-1);

        expect(finalForA.element.version).toBe(finalForB.element.version);
        expect(finalForA.element.color).toBe(finalForB.element.color);

        clientA.close();
        clientB.close();
    });

    it("a delete's version outranks a late-arriving stale insert for the same element", async () => {
        const shareId = "board-lww-delete-tombstone";
        const client = await connectClient("userC");
        client.emit("client:joinRoom", { shareId, name: "C" });
        await waitFor(client, "server:joinedRoom");

        const elementId = "el-tombstone";
        const events = [];
        client.on("server:addNewElement", (p) => events.push({ op: "add", ...p }));
        client.on("server:deleteElement", (p) => events.push({ op: "delete", ...p }));

        client.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId,
            element: {
                type: "shape",
                shapeType: "Rectangle",
                startX: 0,
                startY: 0,
                endX: 10,
                endY: 10,
                color: "red",
                fillColor: null,
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
        });
        await vi.waitUntil(() => events.length >= 1);
        const insertVersion = events[0].element.version;

        client.emit("client:updateCanvas", { shareId, operation: "delete", elementId });
        await vi.waitUntil(() => events.length >= 2);
        const deleteVersion = events[1].version;

        expect(deleteVersion).toBeGreaterThan(insertVersion);

        client.close();
    });
});

describe("client:updateBackground", () => {
    it("broadcasts to every client in the room, including the sender, and joinedRoom reflects it on a later join", async () => {
        const shareId = "board-background-broadcast";
        const clientA = await connectClient("userG");
        const clientB = await connectClient("userH");

        clientA.emit("client:joinRoom", { shareId, name: "G" });
        await waitFor(clientA, "server:joinedRoom");
        clientB.emit("client:joinRoom", { shareId, name: "H" });
        await waitFor(clientB, "server:joinedRoom");

        const receivedByA = waitFor(clientA, "server:backgroundUpdated");
        const receivedByB = waitFor(clientB, "server:backgroundUpdated");

        clientA.emit("client:updateBackground", {
            shareId,
            background: { type: "isometric", colorToken: "canvas-grid" },
        });

        const [payloadA, payloadB] = await Promise.all([receivedByA, receivedByB]);
        expect(payloadA.background).toEqual({ type: "isometric", colorToken: "canvas-grid" });
        expect(payloadB.background).toEqual({ type: "isometric", colorToken: "canvas-grid" });

        const clientC = await connectClient("userI");
        clientC.emit("client:joinRoom", { shareId, name: "I" });
        const joined = await waitFor(clientC, "server:joinedRoom");
        expect(joined.background).toEqual({ type: "isometric", colorToken: "canvas-grid" });

        clientA.close();
        clientB.close();
        clientC.close();
    });

    it("denies a viewer's attempt to change the background", async () => {
        const shareId = "board-background-denied";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });
        const client = await connectClient("userJ");
        client.emit("client:joinRoom", { shareId, name: "J" });
        await waitFor(client, "server:joinedRoom");

        const denied = waitFor(client, "server:canvasAccessDenied");
        client.emit("client:updateBackground", { shareId, background: { type: "dot", colorToken: null } });
        await denied;

        client.close();
    });
});

describe("client:updateCanvas payload validation", () => {
    const validShapeElement = {
        type: "shape",
        shapeType: "Rectangle",
        startX: 0,
        startY: 0,
        endX: 10,
        endY: 10,
        color: "red",
        fillColor: null,
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    };

    it("silently drops a payload with an unrecognized element type instead of broadcasting or persisting it", async () => {
        const shareId = "board-validation-bad-element";
        const client = await connectClient("userD");
        client.emit("client:joinRoom", { shareId, name: "D" });
        await waitFor(client, "server:joinedRoom");

        const events = [];
        client.on("server:addNewElement", (p) => events.push(p));

        client.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "bad-1",
            element: { type: "script", payload: "malicious" },
        });

        // Asserts on a real later event rather than a timeout, so a slow machine can't pass falsely.
        client.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "good-1",
            element: validShapeElement,
        });
        await vi.waitUntil(() => events.length >= 1);

        expect(events).toHaveLength(1);
        expect(events[0].elementId).toBe("good-1");

        client.close();
    });

    it("drops a payload whose shareId fails the nanoid-shaped check, never reaching room lookup", async () => {
        const client = await connectClient("userE");
        client.emit("client:joinRoom", { shareId: "board-validation-shareid", name: "E" });
        await waitFor(client, "server:joinedRoom");

        const notFoundEvents = [];
        client.on("server:canvasNotFound", () => notFoundEvents.push(true));

        client.emit("client:updateCanvas", {
            shareId: "../etc/passwd",
            operation: "insert",
            elementId: "x",
            element: validShapeElement,
        });

        // The schema rejects it before lookup, or server:canvasNotFound would arrive.
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(notFoundEvents).toHaveLength(0);

        client.close();
    });

    it("rejects an insert with a points array over the 10k cap", async () => {
        const shareId = "board-validation-oversized-path";
        const client = await connectClient("userF");
        client.emit("client:joinRoom", { shareId, name: "F" });
        await waitFor(client, "server:joinedRoom");

        const events = [];
        client.on("server:addNewElement", (p) => events.push(p));

        client.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "huge-path",
            element: {
                type: "path",
                points: Array.from({ length: 10001 }, () => ({ x: 0, y: 0 })),
                color: "black",
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
        });

        client.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "good-2",
            element: validShapeElement,
        });
        await vi.waitUntil(() => events.length >= 1);

        expect(events).toHaveLength(1);
        expect(events[0].elementId).toBe("good-2");

        client.close();
    });
});
