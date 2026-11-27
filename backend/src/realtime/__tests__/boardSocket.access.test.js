import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";

// Every database touch goes through these modules, so the real socket server runs here with none.
vi.mock("../../services/notifications.js", () => ({ notify: vi.fn().mockResolvedValue(null), userRoom: (userId) => `user:${userId}` }));
vi.mock("../../services/boards.js", () => ({
    getBoardTitle: vi.fn().mockResolvedValue("Board"),
    SAVE_RESULT: { SAVED: "saved", BOARD_GONE: "board-gone", FAILED: "failed", NOTHING_TO_SAVE: "nothing-to-save" },
    saveCanvasToDB: vi.fn().mockResolvedValue("saved"),
    closeLiveRoom: vi.fn(),
    loadDataFromDB: vi.fn().mockResolvedValue({}),
    getAccessForShareId: vi.fn(),
    findDrawingByShareId: vi.fn(async (shareId) => (shareId === publicBoard.shareId ? publicBoard : null)),
    getCollaboratorUserIds: vi.fn().mockResolvedValue(new Set()),
    getCollaboratorUsernames: vi.fn().mockResolvedValue(new Map()),
    recordLastSeen: vi.fn().mockResolvedValue(undefined),
    getUsername: vi.fn(async (userId) => `name-of-${userId}`),
}));
vi.mock("../../services/comments.js", () => ({ getCommentsForShareId: vi.fn().mockResolvedValue([]) }));
vi.mock("../../services/operationLog.js", () => ({
    appendOp: vi.fn().mockResolvedValue(1),
    flushOperationLog: vi.fn().mockResolvedValue(undefined),
    diffToRestore: vi.fn(),
    getLatestSeq: vi.fn().mockResolvedValue(0),
}));
vi.mock("../../search/indexBoard.js", () => ({ indexBoardForSearchSafely: vi.fn().mockResolvedValue(undefined) }));
const publicBoard = { shareId: "board-public", owner: "owner", collaborators: [], linkAccess: "viewer" };
vi.mock("../../liveRooms/liveScene.js", () => ({ getLiveOrPersistedScene: vi.fn().mockResolvedValue({ elements: {}, background: null }) }));

const { getAccessForShareId } = await import("../../services/boards.js");
const canvasStore = (await import("../../liveRooms/canvasStore.js")).default;
const socketLogic = (await import("../boardSocket.js")).default;
const { enforceLiveAccess } = await import("../../services/liveAccess.js");

let httpServer;
let io;
let port;

const connectClient = (userId) =>
    new Promise((resolve, reject) => {
        const client = ioClient(`http://localhost:${port}`, {
            auth: { token: jwt.sign({ userId }, process.env.JWT_SECRET) },
            transports: ["websocket"],
            forceNew: true,
        });
        client.once("connect", () => resolve(client));
        client.once("connect_error", reject);
    });

const connectSignedOut = () =>
    new Promise((resolve, reject) => {
        const client = ioClient(`http://localhost:${port}`, { auth: { watchOnly: true }, transports: ["websocket"], forceNew: true });
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
    getAccessForShareId.mockReset();
    getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
});

describe("refused and misplaced changes", () => {
    const strokeOf = (pointCount) => ({
        type: "path",
        points: Array.from({ length: pointCount }, (_, i) => ({ x: 1000 + i * 0.731234567, y: -500 + i * 0.4123456789, pressure: 0.512345678 })),
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    });

    const join = async (userId, shareId) => {
        const client = await connectClient(userId);
        const joined = waitFor(client, "server:joinedRoom");
        client.emit("client:joinRoom", { shareId, name: "anything" });
        await joined;
        return client;
    };

    it("accepts a long stroke a person can really draw", async () => {
        const shareId = "board-long-stroke";
        const client = await join("longStroker", shareId);
        const added = waitFor(client, "server:addNewElement");
        client.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "long", element: strokeOf(3200) });
        expect((await added).element.points).toHaveLength(3200);
        client.close();
    });

    it("tells the sender when a change is refused and hands back the room's copy", async () => {
        const shareId = "board-refused-change";
        const client = await join("oversized", shareId);
        const rejected = waitFor(client, "server:elementRejected");
        client.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "too-long", element: strokeOf(10001) });
        expect(await rejected).toEqual({ elementId: "too-long", element: null, reason: "invalid" });
        client.close();
    });

    it("hands a viewer's refused edit back so it never stays on their screen", async () => {
        const shareId = "board-viewer-draws";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });
        const client = await join("viewerDraws", shareId);
        const rejected = waitFor(client, "server:elementRejected");
        client.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "nope", element: strokeOf(3) });
        expect(await rejected).toEqual({ elementId: "nope", element: null, reason: "denied" });
        client.close();
    });

    it("relays a note's shared text between editors with its handshake, and never from a viewer", async () => {
        const shareId = "board-shared-text";
        const editor = await join("textEditor", shareId);
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });
        const viewer = await join("textViewer", shareId);
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        const otherEditor = await join("otherTextEditor", shareId);
        const heard = [];
        editor.on("server:textSync", (payload) => heard.push(payload));
        viewer.emit("client:textSync", { shareId, elementId: "note", update: "AAA=" });
        const relayed = waitFor(editor, "server:textSync");
        otherEditor.emit("client:textSync", { shareId, elementId: "note", update: "AQ==", wantsState: true });
        expect(await relayed).toEqual({ elementId: "note", update: "AQ==", wantsState: true, isState: false });
        expect(heard).toHaveLength(1);
        for (const client of [editor, viewer, otherEditor]) client.close();
    });

    it("names people by their account, whatever name the client sends", async () => {
        const shareId = "board-server-names";
        const client = await connectClient("realPerson");
        const presence = waitFor(client, "server:presenceUpdate");
        client.emit("client:joinRoom", { shareId, name: "The Owner" });
        expect((await presence).map((participant) => participant.name)).toEqual(["name-of-realPerson"]);
        client.close();
    });

    it("leaves the first board when the same connection opens another", async () => {
        const client = await join("boardHopper", "board-hop-first");
        const joined = waitFor(client, "server:joinedRoom");
        client.emit("client:joinRoom", { shareId: "board-hop-second", name: "x" });
        await joined;
        expect(await canvasStore.getParticipant("board-hop-first", client.id)).toBeNull();
        expect(await canvasStore.getParticipant("board-hop-second", client.id)).not.toBeNull();
        client.close();
    });

    it("drops a connection whose re-join is refused out of the room", async () => {
        const shareId = "board-rejoin-refused";
        const owner = await join("ownerStays", shareId);
        const removed = await join("removedEditor", shareId);
        getAccessForShareId.mockImplementation(async (_, principal) => ({ exists: true, role: principal.userId === "removedEditor" ? null : "owner" }));

        const denied = waitFor(removed, "server:canvasAccessDenied");
        removed.emit("client:joinRoom", { shareId, name: "x" });
        await denied;
        let leaked = false;
        removed.on("server:addNewElement", () => {
            leaked = true;
        });
        const delivered = waitFor(owner, "server:addNewElement");
        owner.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "after-removal", element: strokeOf(3) });
        await delivered;
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(leaked).toBe(false);
        expect(await canvasStore.getParticipant(shareId, removed.id)).toBeNull();
        owner.close();
        removed.close();
    });
});

describe("signed-out viewers of a board shared by link", () => {
    it("watch it live with no account, and are cut off the moment link sharing is turned off", async () => {
        const { shareId } = publicBoard;
        const owner = await connectClient("owner");
        const joined = waitFor(owner, "server:joinedRoom");
        owner.emit("client:joinRoom", { shareId, name: "x" });
        await joined;
        const visitor = await connectSignedOut();
        const live = waitFor(visitor, "watch:live");
        visitor.emit("watch:start", { shareId, via: "link" });
        await live;

        const seen = waitFor(visitor, "server:addNewElement");
        owner.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "shared",
            element: { type: "text", x: 0, y: 0, width: 50, text: "hi", color: "#000", size: 16, zIndex: 1, rotation: 0 },
        });
        expect((await seen).elementId).toBe("shared");

        const refused = waitFor(visitor, "watch:refused");
        publicBoard.linkAccess = "none";
        await enforceLiveAccess(publicBoard, { io });
        await refused;
        let leaked = false;
        visitor.on("server:addNewElement", () => {
            leaked = true;
        });
        const delivered = waitFor(owner, "server:addNewElement");
        owner.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "private",
            element: { type: "text", x: 0, y: 0, width: 50, text: "no", color: "#000", size: 16, zIndex: 1, rotation: 0 },
        });
        await delivered;
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(leaked).toBe(false);
        owner.close();
        visitor.close();
    });

    it("can't do anything but watch", async () => {
        const visitor = await connectSignedOut();
        visitor.emit("client:joinRoom", { shareId: publicBoard.shareId, name: "x" });
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(await canvasStore.getParticipant(publicBoard.shareId, visitor.id)).toBeNull();
        visitor.close();
    });
});

describe("two people changing one element at once", () => {
    it("keeps both changes when they touch different fields", async () => {
        const shareId = "board-merge-fields";
        const original = { type: "text", x: 0, y: 0, width: 80, text: "plan", color: "#000000", size: 16, zIndex: 1, rotation: 0 };
        const clients = [];
        for (const userId of ["mergeA", "mergeB"]) {
            const client = await connectClient(userId);
            const joined = waitFor(client, "server:joinedRoom");
            client.emit("client:joinRoom", { shareId, name: "x" });
            await joined;
            clients.push(client);
        }
        const [first, second] = clients;
        const inserted = waitFor(second, "server:addNewElement");
        first.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "note", element: original });
        await inserted;

        const both = new Promise((resolve) => {
            let seen = 0;
            second.on("server:updateElement", () => (seen += 1) === 2 && resolve());
        });
        first.emit("client:updateCanvas", { shareId, operation: "update", elementId: "note", element: { ...original, color: "#ef4444" }, changed: ["color"] });
        second.emit("client:updateCanvas", { shareId, operation: "update", elementId: "note", element: { ...original, x: 300 }, changed: ["x"] });
        await both;

        expect((await canvasStore.getElements(shareId)).note).toMatchObject({ color: "#ef4444", x: 300, text: "plan" });
        clients.forEach((client) => client.close());
    });
});
