import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../models/drawingSchema.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../../../services/boards.js", () => ({ getUsername: vi.fn() }));
vi.mock("../../../services/operationLog.js", () => ({
    getLatestSeq: vi.fn().mockResolvedValue(5),
    reconstructStateAtSeq: vi.fn(),
    getVersions: vi.fn(),
    createNamedVersion: vi.fn(),
    diffVersions: vi.fn().mockResolvedValue({ added: [], removed: [], moved: [], modified: [] }),
}));

const Drawing = (await import("../../../models/drawingSchema.js")).default;
const { diffVersions } = await import("../../../services/operationLog.js");
const { diffHandler } = await import("../historyController.js");

const respond = () => {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
};

describe("diffHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Drawing.findOne.mockResolvedValue({ hasViewAccess: () => true });
    });

    it("shows a branch's own changes when it is compared with its parent", async () => {
        const req = { params: { shareId: "branch" }, query: { compareShareId: "parent" }, drawing: { parentShareId: "parent" }, user: {} };
        await diffHandler(req, respond());
        expect(diffVersions).toHaveBeenCalledWith({ shareId: "parent", seq: 5 }, { shareId: "branch", seq: 5 });
    });

    it("shows a branch's changes from the parent too", async () => {
        const req = { params: { shareId: "parent" }, query: { compareShareId: "branch" }, drawing: { parentShareId: null }, user: {} };
        await diffHandler(req, respond());
        expect(diffVersions).toHaveBeenCalledWith({ shareId: "parent", seq: 5 }, { shareId: "branch", seq: 5 });
    });
});
