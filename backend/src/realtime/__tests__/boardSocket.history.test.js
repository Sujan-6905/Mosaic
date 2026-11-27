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
const { saveCanvasToDB } = await import("../../services/boards.js");
const canvasStore = (await import("../../liveRooms/canvasStore.js")).default;
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

describe("client:cameraMove / client:presentationUpdate", () => {
    it("relays a camera position to the rest of the room, excluding the sender", async () => {
        const shareId = "board-camera-move";
        const clientA = await connectClient("userS");
        const clientB = await connectClient("userT");

        clientA.emit("client:joinRoom", { shareId, name: "S" });
        await waitFor(clientA, "server:joinedRoom");
        clientB.emit("client:joinRoom", { shareId, name: "T" });
        await waitFor(clientB, "server:joinedRoom");

        const receivedByB = waitFor(clientB, "server:cameraMove");
        const receivedByA = [];
        clientA.on("server:cameraMove", (p) => receivedByA.push(p));

        clientA.emit("client:cameraMove", { shareId, x: 100, y: 200, zoom: 1.5 });
        const payload = await receivedByB;

        expect(payload).toMatchObject({ x: 100, y: 200, zoom: 1.5 });
        expect(receivedByA).toHaveLength(0);

        clientA.close();
        clientB.close();
    });

    it("broadcasts a presentation toggle to the whole room, including the presenter", async () => {
        const shareId = "board-presentation";
        const client = await connectClient("userU");
        client.emit("client:joinRoom", { shareId, name: "U" });
        await waitFor(client, "server:joinedRoom");

        const update = waitFor(client, "server:presentationUpdate");
        client.emit("client:presentationUpdate", { shareId, presenting: true });
        const payload = await update;

        expect(payload).toMatchObject({ presenting: true });

        client.close();
    });
});

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

describe("operation log wiring", () => {
    it("appends an op with the acting user's id and name for insert, update, delete and background mutations", async () => {
        const shareId = "board-oplog";
        const client = await connectClient("userOp");
        client.emit("client:joinRoom", { shareId, name: "Oppy" });
        await waitFor(client, "server:joinedRoom");

        client.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "el-1", element: shapeElement("red") });
        await waitFor(client, "server:addNewElement");
        expect(appendOp).toHaveBeenCalledWith(
            expect.objectContaining({ shareId, opType: "insert", elementId: "el-1", authorId: "userOp", authorName: "name-of-userOp" }),
        );

        client.emit("client:updateCanvas", { shareId, operation: "update", elementId: "el-1", element: shapeElement("blue") });
        await waitFor(client, "server:updateElement");
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "update", elementId: "el-1" }));

        client.emit("client:updateCanvas", { shareId, operation: "delete", elementId: "el-1" });
        await waitFor(client, "server:deleteElement");
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "delete", elementId: "el-1", after: null }));

        client.emit("client:updateBackground", { shareId, background: { type: "dot", colorToken: null } });
        await waitFor(client, "server:backgroundUpdated");
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "background", elementId: null, after: { type: "dot", colorToken: null } }));

        client.close();
    });
});

const waitForCount = (client, event, count) =>
    new Promise((resolve) => {
        const seen = [];
        const handler = (payload) => {
            seen.push(payload);
            if (seen.length >= count) {
                client.off(event, handler);
                resolve(seen);
            }
        };
        client.on(event, handler);
    });

describe("client:clearBoard", () => {
    it("deletes every element as the owner, broadcasts each delete, and acks the requester with the full diff", async () => {
        const shareId = "board-clear";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "owner" });
        const clientA = await connectClient("userClearOwner");
        const clientB = await connectClient("userClearB");
        clientA.emit("client:joinRoom", { shareId, name: "Owner" });
        await waitFor(clientA, "server:joinedRoom");
        clientB.emit("client:joinRoom", { shareId, name: "Bystander" });
        await waitFor(clientB, "server:joinedRoom");

        clientA.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "el-1", element: shapeElement("red") });
        await waitFor(clientA, "server:addNewElement");
        clientA.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "el-2", element: shapeElement("blue") });
        await waitFor(clientA, "server:addNewElement");

        const deletesOnB = waitForCount(clientB, "server:deleteElement", 2);
        const ack = waitFor(clientA, "server:boardCleared");
        clientA.emit("client:clearBoard", { shareId });

        const deletes = await deletesOnB;
        const summary = await ack;

        expect(deletes.map((d) => d.elementId).sort()).toEqual(["el-1", "el-2"]);
        expect(summary.elementOps).toHaveLength(2);
        expect(summary.elementOps.every((op) => op.after === null)).toBe(true);
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "delete", elementId: "el-1" }));
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "delete", elementId: "el-2" }));

        clientA.close();
        clientB.close();
    });

    it("denies an editor - clearing the board is owner-only, stricter than a normal edit", async () => {
        const shareId = "board-clear-denied";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        const client = await connectClient("userClearEditor");
        client.emit("client:joinRoom", { shareId, name: "Editor" });
        await waitFor(client, "server:joinedRoom");

        const denied = waitFor(client, "server:canvasAccessDenied");
        client.emit("client:clearBoard", { shareId });
        await denied;

        client.close();
    });

    it("acks with an empty diff for a board that already has nothing on it", async () => {
        const shareId = "board-clear-empty";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "owner" });
        const client = await connectClient("userClearEmpty");
        client.emit("client:joinRoom", { shareId, name: "Owner" });
        await waitFor(client, "server:joinedRoom");

        const ack = waitFor(client, "server:boardCleared");
        client.emit("client:clearBoard", { shareId });
        const summary = await ack;

        expect(summary.elementOps).toEqual([]);
        client.close();
    });
});

describe("client:restoreVersion", () => {
    it("applies the diff as normal broadcasts, logs each op, and reports the batch back to the requester only", async () => {
        const shareId = "board-restore";
        const clientA = await connectClient("userRestoreA");
        const clientB = await connectClient("userRestoreB");
        clientA.emit("client:joinRoom", { shareId, name: "RA" });
        await waitFor(clientA, "server:joinedRoom");
        clientB.emit("client:joinRoom", { shareId, name: "RB" });
        await waitFor(clientB, "server:joinedRoom");

        diffToRestore.mockResolvedValue({
            elementOps: [
                { elementId: "el-1", before: null, after: shapeElement("green") },
                { elementId: "el-2", before: shapeElement("red"), after: null },
            ],
            background: null,
        });

        const restoredOnB = waitFor(clientB, "server:addNewElement");
        const restoredSummary = waitFor(clientA, "server:versionRestored");
        clientA.emit("client:restoreVersion", { shareId, seq: 3 });

        await restoredOnB;
        const summary = await restoredSummary;

        expect(summary.seq).toBe(3);
        expect(summary.elementOps).toHaveLength(2);
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "insert", elementId: "el-1" }));
        expect(appendOp).toHaveBeenCalledWith(expect.objectContaining({ opType: "delete", elementId: "el-2" }));

        clientA.close();
        clientB.close();
    });

    it("denies a viewer's attempt to restore a version", async () => {
        const shareId = "board-restore-denied";
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });
        const client = await connectClient("userViewerRestore");
        client.emit("client:joinRoom", { shareId, name: "Viewer" });
        await waitFor(client, "server:joinedRoom");

        const denied = waitFor(client, "server:canvasAccessDenied");
        client.emit("client:restoreVersion", { shareId, seq: 1 });
        await denied;

        expect(diffToRestore).not.toHaveBeenCalled();
        client.close();
    });
});

describe("leaving a board while saves are failing", () => {
    const stroke = {
        type: "path",
        points: [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
        ],
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    };

    const joinAndDraw = async (shareId) => {
        const client = await connectClient("drawer");
        const joined = waitFor(client, "server:joinedRoom");
        client.emit("client:joinRoom", { shareId, name: "Drawer" });
        await joined;
        const drawn = waitFor(client, "server:addNewElement");
        client.emit("client:updateCanvas", { shareId, operation: "insert", elementId: "stroke-1", element: stroke });
        await drawn;
        return client;
    };

    const savesFor = (shareId) => saveCanvasToDB.mock.calls.filter(([{ canvasShareId }]) => canvasShareId === shareId);

    const leave = async (client, shareId) => {
        client.close();
        await vi.waitFor(() => expect(savesFor(shareId).length).toBeGreaterThan(0));
        await new Promise((resolve) => setTimeout(resolve, 50));
    };

    // Keyed by board, since an earlier test's client can still be disconnecting.
    const failNextSaveOf = (failingShareId) => {
        let failed = false;
        saveCanvasToDB.mockImplementation(async ({ canvasShareId }) => {
            if (canvasShareId !== failingShareId || failed) return "saved";
            failed = true;
            return "failed";
        });
    };

    const rejoin = async (shareId) => {
        const client = await connectClient("drawer");
        const joined = waitFor(client, "server:joinedRoom");
        client.emit("client:joinRoom", { shareId, name: "Drawer" });
        const payload = await joined;
        client.close();
        return payload;
    };

    beforeEach(async () => {
        saveCanvasToDB.mockReset();
        saveCanvasToDB.mockResolvedValue("saved");
        while (await canvasStore.popDirty()) {
            /* other tests' boards would join the sweep */
        }
    });

    it("keeps unsaved strokes in the room when the last person's save fails", async () => {
        const shareId = "board-save-failed";
        failNextSaveOf(shareId);
        await leave(await joinAndDraw(shareId), shareId);

        expect(await canvasStore.roomExists(shareId)).toBe(true);
        expect((await rejoin(shareId)).elements["stroke-1"]).toBeDefined();
    });

    it("closes the room as usual when the last person's save lands", async () => {
        const shareId = "board-save-ok";
        await leave(await joinAndDraw(shareId), shareId);

        expect(await canvasStore.roomExists(shareId)).toBe(false);
    });

    const captureSweep = () => {
        const intervalSpy = vi.spyOn(globalThis, "setInterval");
        const otherIo = new Server(createServer());
        socketLogic(otherIo);
        const calls = intervalSpy.mock.calls;
        intervalSpy.mockRestore();
        return { sweep: calls.find(([, ms]) => ms === 15_000)[0], close: () => otherIo.close() };
    };

    it("never saves an empty board for a room that has already closed", async () => {
        const { sweep, close } = captureSweep();
        await canvasStore.markDirty("board-already-closed");

        sweep();
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(savesFor("board-already-closed")).toEqual([]);
        expect(await canvasStore.popDirty()).toBeNull();
        close();
    });

    it("closes a room nobody came back to once the retried save lands", async () => {
        const shareId = "board-retry-lands";
        failNextSaveOf(shareId);
        await leave(await joinAndDraw(shareId), shareId);
        expect(await canvasStore.roomExists(shareId)).toBe(true);

        const { sweep, close } = captureSweep();
        sweep();
        await vi.waitFor(async () => expect(await canvasStore.roomExists(shareId)).toBe(false));

        expect(savesFor(shareId).at(-1)[0].canvasElements["stroke-1"]).toBeDefined();
        close();
    });
});
