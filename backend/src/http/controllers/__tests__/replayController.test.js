import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/operationLog.js", () => ({ flushOperationLog: vi.fn().mockResolvedValue(undefined), reconstructStateAtSeq: vi.fn() }));
const ottomanQuery = vi.fn();
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: ottomanQuery }) }));

const { flushOperationLog, reconstructStateAtSeq } = await import("../../../services/operationLog.js");
const { detectNotableMoments, getReplayTimelineHandler, getReplayWindowHandler, REPLAY_WINDOW_SIZE } = await import("../replayController.js");

const fakeRes = () => {
    const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
    return res;
};
const row = (seq, overrides = {}) => ({ seq, ts: seq * 1000, authorId: "u1", authorName: "ada", ...overrides });

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CB_BUCKET_NAME = "test-bucket";
});

describe("detectNotableMoments", () => {
    it("flags a burst of edits landing within two seconds", () => {
        const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, { ts: i * 100 }));
        expect(detectNotableMoments(rows).some((m) => m.label === "Burst of edits")).toBe(true);
    });

    it("flags a new session after a long silence", () => {
        const rows = [row(1, { ts: 0 }), row(2, { ts: 10 * 60 * 1000 })];
        expect(detectNotableMoments(rows)).toContainEqual({ seq: 2, label: "New session" });
    });

    it("finds no moments in a slow, steady trickle of edits", () => {
        const rows = Array.from({ length: 5 }, (_, i) => row(i + 1, { ts: i * 60 * 1000 }));
        expect(detectNotableMoments(rows)).toEqual([]);
    });
});

describe("getReplayTimelineHandler", () => {
    it("flushes the board's buffered changes, then reports range and authors without element data", async () => {
        ottomanQuery.mockResolvedValue({ rows: [row(31), row(32, { authorId: "u2", authorName: "ben" }), row(33)] });
        const res = fakeRes();

        await getReplayTimelineHandler({ params: { shareId: "s1" } }, res);

        expect(flushOperationLog).toHaveBeenCalledWith("s1");
        expect(ottomanQuery.mock.calls[0][0]).not.toMatch(/after/);
        expect(res.json).toHaveBeenCalledWith({
            firstSeq: 30,
            latestSeq: 33,
            authors: [
                { id: "u1", name: "ada" },
                { id: "u2", name: "ben" },
            ],
            moments: [],
        });
    });

    it("still answers from the stored log when the flush fails", async () => {
        flushOperationLog.mockRejectedValueOnce(new Error("db down"));
        ottomanQuery.mockResolvedValue({ rows: [] });
        const res = fakeRes();

        await getReplayTimelineHandler({ params: { shareId: "s1" } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ firstSeq: 0, latestSeq: 0, authors: [], moments: [] });
    });
});

describe("getReplayWindowHandler", () => {
    const state = { elements: { a: { id: "a" } }, background: { type: "blank", colorToken: null }, seq: 10 };

    it("returns the board at seq plus at most one window of the changes after it", async () => {
        reconstructStateAtSeq.mockResolvedValue(state);
        ottomanQuery.mockResolvedValue({ rows: Array.from({ length: REPLAY_WINDOW_SIZE + 1 }, (_, i) => row(11 + i)) });
        const res = fakeRes();

        await getReplayWindowHandler({ params: { shareId: "s1" }, query: { seq: "10" } }, res);

        expect(reconstructStateAtSeq).toHaveBeenCalledWith("s1", 10);
        const body = res.json.mock.calls[0][0];
        expect(body).toMatchObject({ baseSeq: 10, elements: state.elements, background: state.background, hasMore: true });
        expect(body.ops).toHaveLength(REPLAY_WINDOW_SIZE);
    });

    it("with an author, starts just before that person's next change", async () => {
        reconstructStateAtSeq.mockResolvedValue(state);
        ottomanQuery.mockResolvedValueOnce({ rows: [{ nextSeq: 57 }] }).mockResolvedValueOnce({ rows: [row(57, { authorId: "u2" })] });
        const res = fakeRes();

        await getReplayWindowHandler({ params: { shareId: "s1" }, query: { seq: "10", authorId: "u2" } }, res);

        expect(reconstructStateAtSeq).toHaveBeenCalledWith("s1", 56);
        expect(res.json.mock.calls[0][0]).toMatchObject({ baseSeq: 56, hasMore: false });
    });

    it("says so when the author makes no later change", async () => {
        ottomanQuery.mockResolvedValueOnce({ rows: [{ nextSeq: null }] });
        const res = fakeRes();

        await getReplayWindowHandler({ params: { shareId: "s1" }, query: { seq: "10", authorId: "u2" } }, res);

        expect(res.json).toHaveBeenCalledWith({ exhausted: true });
        expect(reconstructStateAtSeq).not.toHaveBeenCalled();
    });

    it.each([["-1"], ["1.5"], ["abc"], [undefined]])("refuses seq %s", async (seq) => {
        const res = fakeRes();
        await getReplayWindowHandler({ params: { shareId: "s1" }, query: { seq } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("refuses an author id that isn't one string", async () => {
        const res = fakeRes();
        await getReplayWindowHandler({ params: { shareId: "s1" }, query: { seq: "1", authorId: ["a", "b"] } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
