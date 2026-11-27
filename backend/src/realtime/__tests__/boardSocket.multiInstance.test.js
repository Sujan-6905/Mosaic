import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { io as ioClient } from "socket.io-client";
import RedisMock from "ioredis-mock";
import jwt from "jsonwebtoken";
import createRedisStore from "../../liveRooms/redisStore.js";

// Two socket servers, each with its own redisStore on an ioredis-mock client sharing one backing,
// stand in for two processes on one Redis.
vi.mock("../../services/notifications.js", () => ({ notify: vi.fn().mockResolvedValue(null), userRoom: (userId) => `user:${userId}` }));
vi.mock("../../services/boards.js", () => ({
    getBoardTitle: vi.fn().mockResolvedValue("Board"),
    SAVE_RESULT: { SAVED: "saved", BOARD_GONE: "board-gone", FAILED: "failed", NOTHING_TO_SAVE: "nothing-to-save" },
    saveCanvasToDB: vi.fn().mockResolvedValue("saved"),
    closeLiveRoom: vi.fn(),
    loadDataFromDB: vi.fn().mockResolvedValue({}),
    getAccessForShareId: vi.fn().mockResolvedValue({ exists: true, role: "editor" }),
    getCollaboratorUserIds: vi.fn().mockResolvedValue(new Set()),
    getUsername: vi.fn(async (userId) => userId),
}));

vi.mock("../../services/operationLog.js", () => ({
    appendOp: vi.fn().mockResolvedValue(1),
    flushOperationLog: vi.fn().mockResolvedValue(undefined),
    diffToRestore: vi.fn(),
    getLatestSeq: vi.fn().mockResolvedValue(0),
}));
vi.mock("../../search/indexBoard.js", () => ({ indexBoardForSearchSafely: vi.fn().mockResolvedValue(undefined) }));
// Joining always loads comments, so the comment model is mocked.
vi.mock("../../services/comments.js", () => ({
    createComment: vi.fn(),
    addReply: vi.fn(),
    setCommentResolved: vi.fn(),
    markCommentRead: vi.fn(),
    getCommentsForShareId: vi.fn().mockResolvedValue([]),
}));

const socketLogic = (await import("../boardSocket.js")).default;

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);

const connectClient = (port, userId) =>
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

// One instance: its own HTTP and Socket.io server, Redis adapter and store, sharing only Redis data.
const bootInstance = async () => {
    const redisClient = new RedisMock();
    const store = createRedisStore(redisClient);

    const httpServer = createServer();
    const io = new Server(httpServer, { cors: { origin: "*" } });
    io.adapter(createAdapter(redisClient, redisClient.duplicate()));
    socketLogic(io, store);

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;

    return {
        port,
        close: () =>
            new Promise((resolve) => {
                io.close();
                httpServer.close(resolve);
            }),
    };
};

let instanceA;
let instanceB;

beforeAll(async () => {
    instanceA = await bootInstance();
    instanceB = await bootInstance();
});

afterAll(async () => {
    await instanceA.close();
    await instanceB.close();
});

describe("two backend instances sharing Redis", () => {
    it("a client on instance B sees a room created via instance A, and elements sync both ways", async () => {
        const shareId = "cross-instance-board";

        const clientA = await connectClient(instanceA.port, "userA");
        clientA.emit("client:joinRoom", { shareId, name: "A" });
        await waitFor(clientA, "server:joinedRoom");

        // The room exists only in shared Redis, yet joining from B sees it as active.
        const clientB = await connectClient(instanceB.port, "userB");
        clientB.emit("client:joinRoom", { shareId, name: "B" });
        const joined = await waitFor(clientB, "server:joinedRoom");
        expect(joined.elements).toEqual({});

        const bReceived = [];
        clientB.on("server:addNewElement", (p) => bReceived.push(p));
        const aReceived = [];
        clientA.on("server:addNewElement", (p) => aReceived.push(p));

        // Only the adapter's pub/sub can carry a stroke from A to a client on B.
        clientA.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "el-from-a",
            element: {
                type: "shape",
                shapeType: "Rectangle",
                startX: 0,
                startY: 0,
                endX: 5,
                endY: 5,
                color: "red",
                fillColor: null,
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
        });
        await vi.waitUntil(() => bReceived.length >= 1, { timeout: 2000 });
        expect(bReceived[0].elementId).toBe("el-from-a");

        // And the reverse direction, B to A.
        clientB.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "el-from-b",
            element: {
                type: "shape",
                shapeType: "Rectangle",
                startX: 0,
                startY: 0,
                endX: 5,
                endY: 5,
                color: "blue",
                fillColor: null,
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
        });
        await vi.waitUntil(() => aReceived.some((e) => e.elementId === "el-from-b"), { timeout: 2000 });

        clientA.close();
        clientB.close();
    });

    it("killing instance A mid-session leaves instance B's room intact - elements already synced survive", async () => {
        const shareId = "cross-instance-survives-kill";

        const clientA = await connectClient(instanceA.port, "userC");
        clientA.emit("client:joinRoom", { shareId, name: "C" });
        await waitFor(clientA, "server:joinedRoom");

        const clientB = await connectClient(instanceB.port, "userD");
        clientB.emit("client:joinRoom", { shareId, name: "D" });
        await waitFor(clientB, "server:joinedRoom");

        // The store write precedes the broadcast, so receipt proves the element is in Redis.
        const bSawElement = waitFor(clientB, "server:addNewElement");
        clientA.emit("client:updateCanvas", {
            shareId,
            operation: "insert",
            elementId: "el-before-kill",
            element: {
                type: "shape",
                shapeType: "Rectangle",
                startX: 0,
                startY: 0,
                endX: 5,
                endY: 5,
                color: "green",
                fillColor: null,
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
        });
        await bSawElement;

        clientA.close();

        // Elements live in the shared store, so B keeps serving them without A.
        const clientE = await connectClient(instanceB.port, "userE");
        clientE.emit("client:joinRoom", { shareId, name: "E" });
        const joined = await waitFor(clientE, "server:joinedRoom");
        expect(joined.elements["el-before-kill"]).toMatchObject({ color: "green" });

        clientB.close();
        clientE.close();
    });
});
