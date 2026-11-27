import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../models/operationLogSchema.js", () => ({ default: { create: vi.fn() } }));
vi.mock("../../models/snapshotSchema.js", () => ({
    default: { create: vi.fn(), removeById: vi.fn() },
}));
vi.mock("../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn(), create: vi.fn() },
}));
vi.mock("../../services/boards.js", () => ({
    loadDataFromDB: vi.fn(),
    getUsername: vi.fn(async (userId) => `name-of-${userId}`),
    getCollaboratorUsernames: vi.fn(async (ids) => new Map([...ids].map((id) => [id, `name-of-${id}`]))),
}));
vi.mock("../../search/indexBoard.js", () => ({ indexBoardForSearchSafely: vi.fn() }));
vi.mock("../../models/mergeBaseSchema.js", () => ({ saveMergeBase: vi.fn() }));
const { saveMergeBase } = await import("../../models/mergeBaseSchema.js");
vi.mock("../../liveRooms/canvasStore.js", () => ({
    default: {
        nextOpSeq: vi.fn(),
        currentOpSeq: vi.fn(),
        appendPendingOp: vi.fn(),
        drainPendingOps: vi.fn(),
        requeuePendingOps: vi.fn(),
        getElements: vi.fn(),
        getBackground: vi.fn(),
        roomExists: vi.fn(),
    },
}));

const ottomanQuery = vi.fn();
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: ottomanQuery }) }));

const OperationLog = (await import("../../models/operationLogSchema.js")).default;
const Snapshot = (await import("../../models/snapshotSchema.js")).default;
const Drawing = (await import("../../models/drawingSchema.js")).default;
const { loadDataFromDB } = await import("../../services/boards.js");
const canvasStore = (await import("../../liveRooms/canvasStore.js")).default;
const { appendOp, flushOperationLog, reconstructStateAtSeq, diffToRestore, diffVersions, createNamedVersion, computeCompactionPlan, getLatestSeq } =
    await import("../../services/operationLog.js");
const { forkBoard, getBranches } = await import("../../http/controllers/branchController.js");

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CB_BUCKET_NAME = "test-bucket";
});

describe("appendOp", () => {
    it("stamps a board-wide seq via canvasStore and buffers the record, never touching the DB", async () => {
        canvasStore.nextOpSeq.mockResolvedValue(5);

        const seq = await appendOp({
            shareId: "board-1",
            opType: "insert",
            elementId: "el-1",
            after: { type: "shape" },
            authorId: "user-1",
            authorName: "Alice",
        });

        expect(seq).toBe(5);
        expect(canvasStore.appendPendingOp).toHaveBeenCalledWith(
            "board-1",
            expect.objectContaining({ seq: 5, opType: "insert", elementId: "el-1", authorId: "user-1" }),
        );
        expect(OperationLog.create).not.toHaveBeenCalled();
    });
});

describe("flushOperationLog", () => {
    it("no-ops when there is nothing buffered", async () => {
        canvasStore.drainPendingOps.mockResolvedValue([]);
        await flushOperationLog("board-1");
        expect(OperationLog.create).not.toHaveBeenCalled();
    });

    it("puts back only the operations whose write failed, and reports the failure", async () => {
        const ops = [1, 2, 3].map((seq) => ({ shareId: "board-1", seq, opType: "insert", elementId: `el-${seq}`, after: {}, authorId: "u1" }));
        canvasStore.drainPendingOps.mockResolvedValue(ops);
        OperationLog.create.mockImplementation(async (op) => {
            if (op.seq === 2) throw new Error("AmbiguousTimeout");
            return op;
        });

        await expect(flushOperationLog("board-1")).rejects.toThrow("AmbiguousTimeout");
        expect(canvasStore.requeuePendingOps).toHaveBeenCalledWith("board-1", [ops[1]]);
        OperationLog.create.mockReset();
    });

    it("persists every drained op and skips snapshotting when under both cadence thresholds", async () => {
        canvasStore.drainPendingOps.mockResolvedValue([{ shareId: "board-1", seq: 1, opType: "insert", elementId: "el-1", after: {}, authorId: "u1" }]);
        ottomanQuery.mockResolvedValue({ rows: [] }); // no prior snapshot

        await flushOperationLog("board-1");

        expect(OperationLog.create).toHaveBeenCalledTimes(1);
        expect(Snapshot.create).not.toHaveBeenCalled();
    });

    it("counts changes across flushes, so a busy board's version isn't waiting on one burst", async () => {
        canvasStore.drainPendingOps.mockResolvedValue([{ shareId: "board-1", seq: 210, opType: "insert", elementId: "el-1", after: {}, authorId: "u1" }]);
        ottomanQuery.mockResolvedValue({ rows: [{ seq: 10, createdAt: new Date().toISOString() }] });

        await flushOperationLog("board-1");

        expect(Snapshot.create).toHaveBeenCalledWith(expect.objectContaining({ seq: 210 }));
    });

    it("gives a new board its first version after a few changes", async () => {
        canvasStore.drainPendingOps.mockResolvedValue([{ shareId: "board-1", seq: 20, opType: "insert", elementId: "el-1", after: {}, authorId: "u1" }]);
        ottomanQuery.mockResolvedValue({ rows: [] });

        await flushOperationLog("board-1");

        expect(Snapshot.create).toHaveBeenCalledWith(expect.objectContaining({ seq: 20 }));
    });

    it("snapshots once the op-count cadence threshold is crossed", async () => {
        process.env.SNAPSHOT_OP_INTERVAL = "2";
        const ops = [
            { shareId: "board-1", seq: 1, opType: "insert", elementId: "el-1", after: {}, authorId: "u1" },
            { shareId: "board-1", seq: 2, opType: "insert", elementId: "el-2", after: {}, authorId: "u2" },
        ];
        canvasStore.drainPendingOps.mockResolvedValue(ops);
        ottomanQuery.mockResolvedValue({ rows: [] });
        canvasStore.getElements.mockResolvedValue({ "el-1": {}, "el-2": {} });
        canvasStore.getBackground.mockResolvedValue({ type: "blank", colorToken: null });

        await flushOperationLog("board-1");

        expect(Snapshot.create).toHaveBeenCalledTimes(1);
        expect(Snapshot.create.mock.calls[0][0]).toMatchObject({
            shareId: "board-1",
            seq: 2,
            automatic: true,
            contributors: expect.arrayContaining(["u1", "u2"]),
        });
        delete process.env.SNAPSHOT_OP_INTERVAL;
    });
});

describe("reconstructStateAtSeq", () => {
    it("replays insert/update/delete/background ops forward from the nearest snapshot", async () => {
        ottomanQuery
            // queryLatestSnapshotAtOrBefore
            .mockResolvedValueOnce({
                rows: [{ _id: "snap-1", seq: 5, elements: { "el-1": { color: "red" } }, background: { type: "blank", colorToken: null } }],
            })
            // queryOpsInRange
            .mockResolvedValueOnce({
                rows: [
                    { seq: 6, opType: "update", elementId: "el-1", after: { color: "blue" } },
                    { seq: 7, opType: "insert", elementId: "el-2", after: { color: "green" } },
                    { seq: 8, opType: "background", elementId: null, after: { type: "dot", colorToken: "canvas-grid" } },
                    { seq: 9, opType: "delete", elementId: "el-2", after: null },
                ],
            });

        const state = await reconstructStateAtSeq("board-1", 9);

        expect(state.elements).toEqual({ "el-1": { color: "blue" } });
        expect(state.background).toEqual({ type: "dot", colorToken: "canvas-grid" });
    });

    it("falls back to an empty board when no snapshot exists yet", async () => {
        ottomanQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ seq: 1, opType: "insert", elementId: "el-1", after: { color: "red" } }] });

        const state = await reconstructStateAtSeq("board-1", 1);

        expect(state.elements).toEqual({ "el-1": { color: "red" } });
    });
});

describe("diffToRestore", () => {
    it("computes insert/update/delete ops needed to move the live board to a target version", async () => {
        ottomanQuery
            .mockResolvedValueOnce({ rows: [] }) // no snapshot
            .mockResolvedValueOnce({
                rows: [
                    { seq: 1, opType: "insert", elementId: "el-1", after: { color: "red" } },
                    { seq: 2, opType: "insert", elementId: "el-2", after: { color: "blue" } },
                ],
            });
        canvasStore.getElements.mockResolvedValue({
            "el-1": { color: "green" }, // changed, needs revert
            "el-3": { color: "yellow" }, // only exists live, needs removal
        });
        canvasStore.getBackground.mockResolvedValue({ type: "blank", colorToken: null });

        const { elementOps, background } = await diffToRestore("board-1", 2);

        expect(elementOps).toEqual(
            expect.arrayContaining([
                { elementId: "el-1", before: { color: "green" }, after: { color: "red" } },
                { elementId: "el-2", before: null, after: { color: "blue" } },
                { elementId: "el-3", before: { color: "yellow" }, after: null },
            ]),
        );
        expect(background).toBeNull();
    });
});

describe("forkBoard", () => {
    it("copies live state into a brand-new board with no collaborators, recording its parent", async () => {
        canvasStore.roomExists.mockResolvedValue(true);
        canvasStore.getElements.mockResolvedValue({ "el-1": { color: "red" } });
        canvasStore.getBackground.mockResolvedValue({ type: "blank", colorToken: null });
        Drawing.findOne.mockResolvedValue({ title: "Original" });
        Drawing.create.mockResolvedValue({ shareId: "new-share-id" });

        await forkBoard({ shareId: "board-1", seq: null, forkerUserId: "user-9" });

        expect(Drawing.create).toHaveBeenCalledWith(
            expect.objectContaining({
                owner: "user-9",
                elements: { "el-1": { color: "red" } },
                parentShareId: "board-1",
                parentSeq: null,
            }),
        );
        const created = Drawing.create.mock.calls[0][0];
        expect(created.collaborators).toBeUndefined();
        expect(saveMergeBase).toHaveBeenCalledWith(expect.any(String), { "el-1": { color: "red" } });
    });

    it("records the inherited content as the branch's first version", async () => {
        canvasStore.roomExists.mockResolvedValue(true);
        canvasStore.getElements.mockResolvedValue({ "el-1": { color: "red" } });
        canvasStore.getBackground.mockResolvedValue({ type: "dot", colorToken: null });
        Drawing.findOne.mockResolvedValue({ title: "Original" });
        Drawing.create.mockResolvedValue({ shareId: "new-share-id" });

        await forkBoard({ shareId: "board-1", seq: null, forkerUserId: "user-9" });

        expect(Snapshot.create).toHaveBeenCalledWith(
            expect.objectContaining({ seq: 0, elements: { "el-1": { color: "red" } }, background: { type: "dot", colorToken: null } }),
        );
    });

    it("falls back to persisted state when the room isn't currently active", async () => {
        canvasStore.roomExists.mockResolvedValue(false);
        loadDataFromDB.mockResolvedValue({ elements: { "el-1": {} }, background: { type: "blank", colorToken: null } });
        Drawing.findOne.mockResolvedValue(null);
        Drawing.create.mockResolvedValue({ shareId: "new-share-id" });

        await forkBoard({ shareId: "board-1", seq: null, forkerUserId: "user-9" });

        expect(loadDataFromDB).toHaveBeenCalledWith("board-1");
        expect(canvasStore.getElements).not.toHaveBeenCalled();
    });
});

describe("createNamedVersion", () => {
    it("records the board as last saved when nobody has it open", async () => {
        canvasStore.roomExists.mockResolvedValue(false);
        loadDataFromDB.mockResolvedValue({ elements: { "el-1": { type: "shape" } }, background: { type: "dot", colorToken: null } });
        ottomanQuery.mockResolvedValue({ rows: [{ maxSeq: 12 }] });

        await createNamedVersion("board-1", { name: "Before review", authorId: "u1", authorName: "ana" });

        expect(Snapshot.create).toHaveBeenCalledWith(expect.objectContaining({ seq: 12, name: "Before review", elements: { "el-1": { type: "shape" } } }));
        expect(canvasStore.getElements).not.toHaveBeenCalled();
    });
});

describe("getBranches", () => {
    it("lists only the branches the caller could open", async () => {
        ottomanQuery.mockResolvedValue({
            rows: [
                { shareId: "mine", owner: "me", title: "Mine", collaborators: [] },
                { shareId: "shared", owner: "ana", title: "Shared", collaborators: [{ userId: "me", role: "viewer" }] },
                { shareId: "private", owner: "ben", title: "Ben's fork", collaborators: [] },
            ],
        });
        const branches = await getBranches("parent", { userId: "me" });
        expect(branches.map((branch) => branch.shareId)).toEqual(["mine", "shared"]);
        expect(branches[0]).not.toHaveProperty("collaborators");
    });
});

describe("diffVersions", () => {
    it("classifies added, removed, moved and modified elements between two reconstructed states", async () => {
        // reconstructStateAtSeq for refA/refB run concurrently (Promise.all),
        // so mock by query shape/params rather than call order.
        const opsForSeq = {
            3: [
                { seq: 1, opType: "insert", elementId: "moved-el", after: { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, color: "red" } },
                { seq: 2, opType: "insert", elementId: "modified-el", after: { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, color: "red" } },
                { seq: 3, opType: "insert", elementId: "removed-el", after: { type: "shape", startX: 0, startY: 0, endX: 5, endY: 5, color: "black" } },
            ],
            4: [
                { seq: 1, opType: "insert", elementId: "moved-el", after: { type: "shape", startX: 20, startY: 20, endX: 30, endY: 30, color: "red" } },
                { seq: 2, opType: "insert", elementId: "modified-el", after: { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, color: "blue" } },
                { seq: 4, opType: "insert", elementId: "added-el", after: { type: "shape", startX: 0, startY: 0, endX: 1, endY: 1, color: "green" } },
            ],
        };
        ottomanQuery.mockImplementation((sql, opts) => {
            if (sql.includes("ORDER BY seq DESC LIMIT 1")) return Promise.resolve({ rows: [] });
            return Promise.resolve({ rows: opsForSeq[opts.parameters.toSeq] || [] });
        });

        const diff = await diffVersions({ shareId: "board-1", seq: 3 }, { shareId: "board-1", seq: 4 });

        expect(diff.added.map((e) => e.elementId)).toEqual(["added-el"]);
        expect(diff.removed.map((e) => e.elementId)).toEqual(["removed-el"]);
        expect(diff.moved.map((e) => e.elementId)).toEqual(["moved-el"]);
        expect(diff.modified.map((e) => e.elementId)).toEqual(["modified-el"]);
        expect(diff.summary.byType).toEqual({ added: 1, removed: 1, moved: 1, modified: 1 });
    });
});

describe("getLatestSeq", () => {
    it("returns the durable max seq from the operation log, surviving a torn-down room", async () => {
        ottomanQuery.mockResolvedValue({ rows: [{ maxSeq: 42 }] });
        expect(await getLatestSeq("board-1")).toBe(42);
    });

    it("returns 0 for a board with no logged ops yet", async () => {
        ottomanQuery.mockResolvedValue({ rows: [{ maxSeq: null }] });
        expect(await getLatestSeq("board-1")).toBe(0);
    });
});

describe("computeCompactionPlan", () => {
    const now = 1_700_000_000_000;
    const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

    it("keeps everything when at or below the minimum snapshot count", () => {
        const snapshots = [
            { _id: "s1", seq: 1, createdAt: daysAgo(100) },
            { _id: "s2", seq: 2, createdAt: daysAgo(50) },
        ];
        const plan = computeCompactionPlan(snapshots, { retentionDays: 30, minSnapshots: 5, now });
        expect(plan.toDeleteSnapshotIds).toEqual([]);
        expect(plan.opsMaxSeqToDelete).toBeNull();
    });

    it("deletes snapshots past the retention window once above the minimum, and compacts ops up to the oldest retained seq", () => {
        const snapshots = [
            { _id: "keep-1", seq: 10, createdAt: daysAgo(1) },
            { _id: "keep-2", seq: 9, createdAt: daysAgo(5) },
            { _id: "old-1", seq: 8, createdAt: daysAgo(60) },
            { _id: "old-2", seq: 7, createdAt: daysAgo(90) },
        ];
        const plan = computeCompactionPlan(snapshots, { retentionDays: 30, minSnapshots: 2, now });
        expect(plan.toDeleteSnapshotIds.sort()).toEqual(["old-1", "old-2"]);
        expect(plan.opsMaxSeqToDelete).toBe(9);
    });

    it("never drops below minSnapshots even if all of them are outside the retention window", () => {
        const snapshots = [
            { _id: "s1", seq: 1, createdAt: daysAgo(200) },
            { _id: "s2", seq: 2, createdAt: daysAgo(150) },
            { _id: "s3", seq: 3, createdAt: daysAgo(100) },
        ];
        const plan = computeCompactionPlan(snapshots, { retentionDays: 30, minSnapshots: 3, now });
        expect(plan.toDeleteSnapshotIds).toEqual([]);
    });
    it("never deletes a version someone named, however old", () => {
        const snapshots = [
            { _id: "recent", seq: 10, createdAt: daysAgo(1) },
            { _id: "launch", seq: 4, createdAt: daysAgo(400), name: "Launch plan" },
            { _id: "old", seq: 3, createdAt: daysAgo(300) },
        ];
        const plan = computeCompactionPlan(snapshots, { retentionDays: 30, minSnapshots: 1, now });
        expect(plan.toDeleteSnapshotIds).toEqual(["old"]);
    });
});
