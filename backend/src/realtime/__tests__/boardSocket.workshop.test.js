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
vi.mock("../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn(async ({ shareId }) => (shareId === publicBoard.shareId ? publicBoard : null)) },
}));
vi.mock("../../http/controllers/embedController.js", () => ({ liveScene: vi.fn().mockResolvedValue({ elements: {}, background: null }) }));

const { getAccessForShareId } = await import("../../services/boards.js");
const canvasStore = (await import("../../liveRooms/canvasStore.js")).default;
const socketLogic = (await import("../boardSocket.js")).default;

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

const waitFor = (client, event) => new Promise((resolve) => client.once(event, resolve));

// The first `event` whose payload passes `check`, since broadcasts from earlier steps can still be arriving.
const waitForMatch = (client, event, check) =>
    new Promise((resolve) => {
        const listener = (payload) => {
            if (!check(payload)) return;
            client.off(event, listener);
            resolve(payload);
        };
        client.on(event, listener);
    });

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

// "lead" runs the session; everyone else may vote but not run it.
beforeEach(() => {
    getAccessForShareId.mockReset();
    getAccessForShareId.mockImplementation(async (_shareId, principal) => ({ exists: true, role: principal?.userId === "lead" ? "editor" : "commenter" }));
});

const join = async (userId, shareId) => {
    const client = await connectClient(userId);
    const joined = waitFor(client, "server:joinedRoom");
    client.emit("client:joinRoom", { shareId, name: userId });
    await joined;
    return client;
};

describe("the shared timer", () => {
    it("reaches everyone on the board, including someone who joins while it runs", async () => {
        const lead = await join("lead", "board-timer");
        const member = await join("member", "board-timer");
        const heard = waitFor(member, "server:timer");
        lead.emit("client:timer", { shareId: "board-timer", action: "start", durationMs: 60_000 });
        const { timer, serverNow } = await heard;
        expect(timer).toMatchObject({ running: true, durationMs: 60_000, startedByName: "name-of-lead" });
        expect(timer.endsAt - serverNow).toBeGreaterThan(55_000);

        const late = await connectClient("late");
        const caughtUp = waitFor(late, "server:timer");
        late.emit("client:joinRoom", { shareId: "board-timer", name: "late" });
        expect((await caughtUp).timer.running).toBe(true);
        [lead, member, late].forEach((client) => client.close());
    });

    it("can't be started by someone who can only comment", async () => {
        const member = await join("member", "board-timer-denied");
        const denied = waitFor(member, "server:canvasAccessDenied");
        member.emit("client:timer", { shareId: "board-timer-denied", action: "start", durationMs: 60_000 });
        await denied;
        expect(await canvasStore.getActivity("board-timer-denied", "timer")).toBeNull();
        member.close();
    });
});

describe("dot voting", () => {
    it("keeps each person's votes to themselves until the vote ends, then shows the tally", async () => {
        const lead = await join("lead", "board-vote");
        const ada = await join("ada", "board-vote");
        const ben = await join("ben", "board-vote");
        await canvasStore.setElement("board-vote", "idea-1", { type: "sticky", text: "one" }, "lead");
        await canvasStore.setElement("board-vote", "idea-2", { type: "sticky", text: "two" }, "lead");

        const opened = waitFor(ada, "server:voting");
        const cleared = waitFor(ada, "server:myVotes");
        lead.emit("client:voteStart", { shareId: "board-vote", votesPerPerson: 2 });
        expect(await opened).toMatchObject({ status: "open", votesPerPerson: 2, voterCount: 0 });
        expect((await cleared).elementIds).toEqual([]);

        const adaOwn = waitFor(ada, "server:myVotes");
        ada.emit("client:vote", { shareId: "board-vote", elementId: "idea-1", add: true });
        expect((await adaOwn).elementIds).toEqual(["idea-1"]);

        const benSees = waitForMatch(ben, "server:voting", (voting) => voting.voterCount === 2);
        ben.emit("client:vote", { shareId: "board-vote", elementId: "idea-1", add: true });
        expect(await benSees).toMatchObject({ status: "open", results: null });

        const revealed = waitForMatch(ben, "server:voting", (voting) => voting.status === "closed");
        lead.emit("client:voting", { shareId: "board-vote", action: "end" });
        expect((await revealed).results).toEqual([{ elementId: "idea-1", count: 2 }]);
        [lead, ada, ben].forEach((client) => client.close());
    });

    it("never takes more votes than each person was given", async () => {
        const lead = await join("lead", "board-vote-limit");
        const ada = await join("ada", "board-vote-limit");
        await canvasStore.setElement("board-vote-limit", "idea", { type: "sticky", text: "x" }, "lead");
        const opened = Promise.all([waitFor(ada, "server:voting"), waitFor(ada, "server:myVotes")]);
        lead.emit("client:voteStart", { shareId: "board-vote-limit", votesPerPerson: 1 });
        await opened;
        const first = waitFor(ada, "server:myVotes");
        ada.emit("client:vote", { shareId: "board-vote-limit", elementId: "idea", add: true });
        await first;
        ada.emit("client:vote", { shareId: "board-vote-limit", elementId: "idea", add: true });
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect((await canvasStore.getVotes("board-vote-limit")).ada).toEqual(["idea"]);
        [lead, ada].forEach((client) => client.close());
    });
});
