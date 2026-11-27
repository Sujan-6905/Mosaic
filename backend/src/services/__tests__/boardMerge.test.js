import { describe, expect, it, vi, beforeEach } from "vitest";

const drawings = {};
const live = {};
vi.mock("../../models/drawingSchema.js", () => ({ default: { findOne: vi.fn(async ({ shareId }) => drawings[shareId] ?? null) } }));
vi.mock("../../models/userSchema.js", () => ({ default: { findById: vi.fn(async () => ({ username: "ada" })) } }));
vi.mock("../../liveRooms/canvasStore.js", () => ({
    default: { getElements: vi.fn(async (shareId) => live[shareId]), getBackground: vi.fn(async () => null) },
}));
vi.mock("../roomLoading.js", () => ({ ensureRoomLoaded: vi.fn(), currentElements: vi.fn(async (shareId) => ({ ...live[shareId] })) }));
vi.mock("../boards.js", () => ({ saveCanvasToDB: vi.fn() }));
vi.mock("../../realtime/ioRegistry.js", () => ({ getIo: () => ({ to: () => ({ emit: vi.fn() }) }) }));
vi.mock("../operationLog.js", () => ({ flushOperationLog: vi.fn(), getLatestSeq: vi.fn(async () => 7), reconstructStateAtSeq: vi.fn() }));
vi.mock("../canvasMutations.js", () => ({
    applyElementUpsert: vi.fn(async ({ elementId, element, shareId }) => {
        live[shareId][elementId] = element;
        return { ...element, version: 2 };
    }),
    applyElementDelete: vi.fn(async ({ elementId, shareId }) => {
        delete live[shareId][elementId];
    }),
}));
const bases = {};
vi.mock("../../models/mergeBaseSchema.js", () => ({
    loadMergeBase: vi.fn(async (id) => bases[id] ?? null),
    saveMergeBase: vi.fn(async (id, elements) => {
        bases[id] = elements;
    }),
}));

const { applyMerge, previewMerge } = await import("../boardMerge.js");
const { applyElementUpsert } = await import("../canvasMutations.js");

const box = (x, extra = {}) => ({ type: "shape", shapeType: "Rectangle", startX: x, startY: 0, endX: x + 50, endY: 50, color: "#000", ...extra });
const drawing = (shareId, extra) => ({ _id: shareId, shareId, title: shareId, hasEditAccess: (id) => id === "editor", hasViewAccess: () => true, ...extra });

beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(drawings, { main: drawing("main"), idea: drawing("idea", { parentShareId: "main" }) });
    Object.keys(bases).forEach((key) => delete bases[key]);
    bases.idea = { a: box(0), b: box(100) };
    live.main = { a: box(0, { color: "#00f" }), b: box(100) };
    live.idea = { a: box(0, { color: "#f00" }), b: box(100, { text: "new words" }), c: box(300) };
});

describe("merging a branch", () => {
    it("previews clean changes, conflicts and counts from the kept base", async () => {
        const preview = await previewMerge({ branchShareId: "idea", direction: "intoParent", caller: "editor" });
        expect(preview.counts).toEqual({ added: 1, changed: 1, removed: 0 });
        expect(preview.conflicts).toEqual([expect.objectContaining({ elementId: "a", parts: ["color"] })]);
        expect(preview.approximateBase).toBe(false);
        expect(preview.targetSeq).toBe(7);
    });

    it("refuses someone without edit access to the receiving board", async () => {
        await expect(previewMerge({ branchShareId: "idea", direction: "intoParent", caller: "viewer" })).rejects.toMatchObject({ status: 403 });
    });

    it("refuses a board that isn't a branch", async () => {
        await expect(previewMerge({ branchShareId: "main", direction: "intoParent", caller: "editor" })).rejects.toMatchObject({ status: 404 });
    });

    it("refuses to apply when the receiving board changed after the preview", async () => {
        await expect(applyMerge({ branchShareId: "idea", direction: "intoParent", caller: "editor", choices: {}, expectedTargetSeq: 3 })).rejects.toMatchObject(
            { status: 409 },
        );
        expect(applyElementUpsert).not.toHaveBeenCalled();
    });

    it("applies the chosen result to the receiving board and remembers where both now agree", async () => {
        const result = await applyMerge({ branchShareId: "idea", direction: "intoParent", caller: "editor", choices: { a: "take" }, expectedTargetSeq: 7 });
        expect(live.main.a.color).toBe("#f00");
        expect(live.main.b.text).toBe("new words");
        expect(live.main.c).toBeTruthy();
        expect(result.counts).toEqual({ added: 1, changed: 2, removed: 0 });
        expect(bases.idea).toEqual(live.idea);
        const again = await previewMerge({ branchShareId: "idea", direction: "intoParent", caller: "editor" });
        expect(again.ops).toEqual([]);
        expect(again.conflicts).toEqual([]);
    });

    it("brings the parent's changes into the branch the other way round", async () => {
        const preview = await previewMerge({ branchShareId: "idea", direction: "fromParent", caller: "editor" });
        expect(preview.target.shareId).toBe("idea");
        expect(preview.conflicts.map((conflict) => conflict.elementId)).toEqual(["a"]);
    });
});
