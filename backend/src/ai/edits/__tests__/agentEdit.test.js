import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/boards.js", () => ({ getAccessForShareId: vi.fn() }));

// Re-implemented here because the real module connects to Couchbase on import.
const GEOMETRY_KEYS = ["x", "y", "startX", "startY", "endX", "endY"];
const omitKeys = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
const classifyChange = (before, after) => {
    const geometryChanged = GEOMETRY_KEYS.some((key) => before[key] !== after[key]);
    const pointsChanged = JSON.stringify(before.points) !== JSON.stringify(after.points);
    const nonGeometryKeys = [...GEOMETRY_KEYS, "points"];
    const restChanged = JSON.stringify(omitKeys(before, nonGeometryKeys)) !== JSON.stringify(omitKeys(after, nonGeometryKeys));
    return (geometryChanged || pointsChanged) && !restChanged ? "moved" : "modified";
};

vi.mock("../../../http/controllers/historyController.js", () => ({ classifyChange }));
vi.mock("../../../services/operationLog.js", () => ({ appendOp: vi.fn().mockResolvedValue(1) }));

vi.mock("../../../realtime/ioRegistry.js", () => ({
    getIo: vi.fn(() => ({ to: () => ({ emit: vi.fn() }) })),
}));

const { getAccessForShareId } = await import("../../../services/boards.js");
const { applyAgentEdit, planAgentEdit, commitPlannedEdit, discardPlannedEdit, rebasePlannedEdit, revertAppliedEdit } = await import("../agentEdit.js");
const canvasStore = (await import("../../../liveRooms/canvasStore.js")).default;
const { buildCanonicalScene, elementIdToRef } = await import("../../../grounding/canonicalScene.js");
const { getMetrics, _resetForTests: _resetMetricsForTests } = await import("../../../observability/metrics.js");

// Batches address objects by grounded ref, looked up the way real callers do.
const refFor = (elements, elementId) => elementIdToRef(buildCanonicalScene(elements), elementId);

const shape = (overrides = {}) => ({
    type: "shape",
    shapeType: "rectangle",
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    startX: 0,
    startY: 0,
    endX: 50,
    endY: 50,
    ...overrides,
});

const setUpRoom = async (shareId, elements) => {
    await canvasStore.createRoom(shareId);
    await canvasStore.seedElements(shareId, elements);
};

describe("applyAgentEdit", () => {
    beforeEach(async () => {
        getAccessForShareId.mockReset();
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        _resetMetricsForTests();
    });

    it("applies a valid batch and commits it live", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);

        const result = await applyAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            correlationId: "corr-1",
            rawEditBatch: { ops: [{ op: "align", refs: [refFor(elements, "a"), refFor(elements, "b")], edge: "left" }] },
        });

        expect(result.status).toBe("applied");
        const live = await canvasStore.getElements(shareId);
        expect(live.b.startX).toBe(0);
    });

    it("rejects an unauthorised user re-checked at commit time", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);
        getAccessForShareId.mockResolvedValue({ exists: true, role: "viewer" });

        const result = await applyAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            correlationId: "corr-1",
            rawEditBatch: { ops: [{ op: "align", refs: [refFor(elements, "a"), refFor(elements, "b")], edge: "left" }] },
        });

        expect(result.status).toBe("unauthorized");
        const live = await canvasStore.getElements(shareId);
        expect(live.b.startX).toBe(200); // untouched
    });

    it("never mutates a locked element", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape({ locked: true }), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);

        const result = await applyAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            correlationId: "corr-1",
            rawEditBatch: { ops: [{ op: "restyle", ref: refFor(elements, "a"), props: { color: "red" } }] },
        });

        expect(result.status).toBe("rejected");
        const live = await canvasStore.getElements(shareId);
        expect(live.a.color).toBe("#000000");
        expect(getMetrics({ rooms: 0, sockets: 0, roomOccupancy: 0 }).grounding.sanitizationDropsToday).toBeGreaterThan(0);
    });

    it("returns invalid for a malformed batch without throwing", async () => {
        const shareId = `room-${Math.random()}`;
        await setUpRoom(shareId, { a: shape() });

        const result = await applyAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            correlationId: "corr-1",
            rawEditBatch: { ops: [{ op: "not-a-real-op" }] },
        });

        expect(result.status).toBe("invalid");
    });
});

describe("planAgentEdit / commitPlannedEdit", () => {
    beforeEach(async () => {
        getAccessForShareId.mockReset();
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        _resetMetricsForTests();
    });

    it("plans without touching the live board, then commits on request", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);

        const plan = await planAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            rawEditBatch: { ops: [{ op: "align", refs: [refFor(elements, "a"), refFor(elements, "b")], edge: "left" }] },
        });

        expect(plan.status).toBe("planned");
        expect(plan.opsPreview).toEqual([{ index: 0, op: "align", summary: expect.stringContaining("Align 2 objects"), elementIds: ["b"] }]);
        expect((await canvasStore.getElements(shareId)).b.startX).toBe(200); // untouched by planning alone

        const result = await commitPlannedEdit({ token: plan.token, shareId, drawing: { elements: {} }, userId: "u1", correlationId: "corr-1" });

        expect(result.status).toBe("applied");
        expect((await canvasStore.getElements(shareId)).b.startX).toBe(0);
    });

    it("commits only the accepted subset of a multi-operation plan", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = {
            a: shape(),
            b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }),
            c: shape({ startX: 400, startY: 400, endX: 450, endY: 450 }),
        };
        await setUpRoom(shareId, elements);

        const plan = await planAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            rawEditBatch: {
                ops: [
                    { op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } },
                    { op: "restyle", ref: refFor(elements, "c"), props: { color: "#00ff00" } },
                ],
            },
        });

        expect(plan.status).toBe("planned");
        const result = await commitPlannedEdit({
            token: plan.token,
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            correlationId: "corr-1",
            acceptedIndexes: [0],
        });

        expect(result.status).toBe("applied");
        const live = await canvasStore.getElements(shareId);
        expect(live.b.color).toBe("#ff0000");
        expect(live.c.color).not.toBe("#00ff00");
    });

    it("a token can only be committed once", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);

        const plan = await planAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            rawEditBatch: { ops: [{ op: "align", refs: [refFor(elements, "a"), refFor(elements, "b")], edge: "left" }] },
        });

        await commitPlannedEdit({ token: plan.token, shareId, drawing: { elements: {} }, userId: "u1", correlationId: "corr-1" });
        const replay = await commitPlannedEdit({ token: plan.token, shareId, drawing: { elements: {} }, userId: "u1", correlationId: "corr-2" });

        expect(replay.status).toBe("rejected");
    });

    it("a token cannot be committed by a different user", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);

        const plan = await planAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            rawEditBatch: { ops: [{ op: "align", refs: [refFor(elements, "a"), refFor(elements, "b")], edge: "left" }] },
        });

        const result = await commitPlannedEdit({ token: plan.token, shareId, drawing: { elements: {} }, userId: "someone-else", correlationId: "corr-1" });
        expect(result.status).toBe("rejected");
    });

    it("discarding a plan leaves no residue and the token stops working", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);

        const plan = await planAgentEdit({
            shareId,
            drawing: { elements: {} },
            userId: "u1",
            rawEditBatch: { ops: [{ op: "align", refs: [refFor(elements, "a"), refFor(elements, "b")], edge: "left" }] },
        });

        expect(discardPlannedEdit(plan.token, "u1")).toBe(true);
        const attempt = await commitPlannedEdit({ token: plan.token, shareId, drawing: { elements: {} }, userId: "u1", correlationId: "corr-1" });
        expect(attempt.status).toBe("rejected");
        expect((await canvasStore.getElements(shareId)).b.startX).toBe(200);
    });
});

describe("reviewing an edit while the board keeps moving", () => {
    const drawing = { elements: {} };
    const three = () => ({
        a: shape(),
        b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }),
        c: shape({ startX: 900, startY: 900, endX: 950, endY: 950 }),
    });

    const planRestyleOfB = async (shareId, elements) =>
        planAgentEdit({ shareId, drawing, userId: "u1", rawEditBatch: { ops: [{ op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } }] } });

    const commit = (shareId, token, extra = {}) => commitPlannedEdit({ token, shareId, drawing, userId: "u1", correlationId: "corr-1", ...extra });

    beforeEach(() => {
        getAccessForShareId.mockReset();
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
        _resetMetricsForTests();
    });

    it("commits when someone only changed something the edit doesn't use", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planRestyleOfB(shareId, elements);

        await canvasStore.setElement(shareId, "c", shape({ startX: 1000, startY: 1000, endX: 1050, endY: 1050 }), "someone-else");
        const result = await commit(shareId, plan.token);

        expect(result.status).toBe("applied");
        const live = await canvasStore.getElements(shareId);
        expect(live.b.color).toBe("#ff0000");
        expect(live.c.startX).toBe(1000);
    });

    it("refuses when the edit's own target changed, and keeps the proposal open", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planRestyleOfB(shareId, elements);

        await canvasStore.setElement(shareId, "b", shape({ startX: 300, startY: 300, endX: 350, endY: 350 }), "someone-else");
        const result = await commit(shareId, plan.token);

        expect(result.status).toBe("conflict");
        expect(result.conflicts.length).toBeGreaterThan(0);
        expect((await canvasStore.getElements(shareId)).b.color).toBe("#000000");

        const rebased = await rebasePlannedEdit({ token: plan.token, shareId, drawing, userId: "u1" });
        expect(rebased.status).toBe("planned");
        expect(rebased.diff.modified[0].after.startX).toBe(300);

        expect((await commit(shareId, rebased.token)).status).toBe("applied");
        const live = await canvasStore.getElements(shareId);
        expect(live.b.color).toBe("#ff0000");
        expect(live.b.startX).toBe(300);
    });

    it("refuses when something the edit positioned against has moved", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planAgentEdit({
            shareId,
            drawing,
            userId: "u1",
            rawEditBatch: { ops: [{ op: "place", ref: refFor(elements, "a"), relation: "below", anchorRef: refFor(elements, "c") }] },
        });
        expect(plan.status).toBe("planned");

        await canvasStore.setElement(shareId, "c", shape({ startX: 100, startY: 100, endX: 150, endY: 150 }), "someone-else");

        expect((await commit(shareId, plan.token)).status).toBe("conflict");
    });

    it("applies what was reviewed, not a fresh calculation from the board now", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planRestyleOfB(shareId, elements);
        const reviewedAfter = plan.diff.modified[0].after;

        const result = await commit(shareId, plan.token);

        expect(result.diff.modified[0].after).toEqual(reviewedAfter);
    });

    it("still applies a single-use token only once after a conflict and retry", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planRestyleOfB(shareId, elements);

        expect((await commit(shareId, plan.token)).status).toBe("applied");
        expect((await commit(shareId, plan.token)).status).toBe("rejected");
    });

    it("lists an operation that couldn't apply separately from the ones it can offer", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planAgentEdit({
            shareId,
            drawing,
            userId: "u1",
            rawEditBatch: {
                ops: [
                    { op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } },
                    { op: "disconnect", refA: refFor(elements, "a"), refB: refFor(elements, "c") },
                ],
            },
        });

        expect(plan.status).toBe("planned");
        expect(plan.opsPreview.map((entry) => entry.index)).toEqual([0]);
        expect(plan.skippedOps).toHaveLength(1);
    });

    it("carries a flagged turn's marking through a rebase", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planAgentEdit({
            shareId,
            drawing,
            userId: "u1",
            tainted: true,
            rawEditBatch: { ops: [{ op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } }] },
        });
        expect(plan.tainted).toBe(true);

        const rebased = await rebasePlannedEdit({ token: plan.token, shareId, drawing, userId: "u1" });
        expect(rebased.tainted).toBe(true);
    });

    it("won't rebase another user's proposal", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = three();
        await setUpRoom(shareId, elements);
        const plan = await planRestyleOfB(shareId, elements);
        expect((await rebasePlannedEdit({ token: plan.token, shareId, drawing, userId: "someone-else" })).status).toBe("rejected");
    });
});

describe("undoing an applied edit later", () => {
    const drawing = { elements: {} };

    const applyEdit = async (shareId, elements, ops) => {
        const plan = await planAgentEdit({ shareId, drawing, userId: "u1", rawEditBatch: { ops } });
        return commitPlannedEdit({ token: plan.token, shareId, drawing, userId: "u1", correlationId: "corr-1" });
    };
    const revert = (shareId, applied, userId = "u1") =>
        revertAppliedEdit({ shareId, drawing, userId, diff: applied.diff, batchId: applied.batchId, correlationId: "corr-2" });

    beforeEach(() => {
        getAccessForShareId.mockReset();
        getAccessForShareId.mockResolvedValue({ exists: true, role: "editor" });
    });

    it("restores what the edit changed and removes what it added", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);
        const applied = await applyEdit(shareId, elements, [
            { op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } },
            { op: "duplicate", ref: refFor(elements, "a"), relation: "below" },
        ]);
        expect(Object.keys(await canvasStore.getElements(shareId))).toHaveLength(3);

        const result = await revert(shareId, applied);

        expect(result.status).toBe("reverted");
        expect(result.skipped).toEqual([]);
        const live = await canvasStore.getElements(shareId);
        expect(Object.keys(live).sort()).toEqual(["a", "b"]);
        expect(live.b.color).toBe("#000000");
    });

    it("puts back what the edit deleted", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);
        const applied = await applyEdit(shareId, elements, [{ op: "delete", refs: [refFor(elements, "b")] }]);
        expect((await canvasStore.getElements(shareId)).b).toBeUndefined();

        await revert(shareId, applied);

        expect((await canvasStore.getElements(shareId)).b.startX).toBe(200);
    });

    it("leaves alone anything changed since, and names it", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);
        const applied = await applyEdit(shareId, elements, [
            { op: "restyle", ref: refFor(elements, "a"), props: { color: "#ff0000" } },
            { op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } },
        ]);

        const later = { ...(await canvasStore.getElements(shareId)).b, color: "#00ff00" };
        await canvasStore.setElement(shareId, "b", later, "someone-else");

        const result = await revert(shareId, applied);

        expect(result.restoredCount).toBe(1);
        expect(result.skipped).toHaveLength(1);
        const live = await canvasStore.getElements(shareId);
        expect(live.a.color).toBe("#000000");
        expect(live.b.color).toBe("#00ff00");
    });

    it("needs edit access at the moment of undoing", async () => {
        const shareId = `room-${Math.random()}`;
        const elements = { a: shape(), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        await setUpRoom(shareId, elements);
        const applied = await applyEdit(shareId, elements, [{ op: "restyle", ref: refFor(elements, "b"), props: { color: "#ff0000" } }]);

        getAccessForShareId.mockResolvedValueOnce({ exists: true, role: "viewer" });
        expect((await revert(shareId, applied)).status).toBe("unauthorized");
        expect((await canvasStore.getElements(shareId)).b.color).toBe("#ff0000");
    });
});
