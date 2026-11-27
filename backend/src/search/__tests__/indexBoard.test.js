import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../models/drawingSchema.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../../models/searchIndexSchema.js", () => ({
    default: { findOne: vi.fn(), create: vi.fn() },
}));

const Drawing = (await import("../../models/drawingSchema.js")).default;
const SearchIndex = (await import("../../models/searchIndexSchema.js")).default;
const { indexBoardForSearch, indexBoardForSearchSafely } = await import("../indexBoard.js");

beforeEach(() => {
    vi.clearAllMocks();
});

describe("indexBoardForSearch", () => {
    it("creates a new index document when none exists yet", async () => {
        Drawing.findOne.mockResolvedValue({ title: "Auth Flow" });
        SearchIndex.findOne.mockResolvedValue(null);

        await indexBoardForSearch("share-1", { t1: { type: "text", text: "login page" } });

        expect(SearchIndex.create).toHaveBeenCalledWith(expect.objectContaining({ shareId: "share-1", title: "Auth Flow" }));
        const created = SearchIndex.create.mock.calls[0][0];
        expect(created.chunks.length).toBe(2); // title + the text element
    });

    it("updates an existing index document in place instead of duplicating it", async () => {
        Drawing.findOne.mockResolvedValue({ title: "Renamed Board" });
        const existing = { title: "Old Name", chunks: [], save: vi.fn().mockResolvedValue(true) };
        SearchIndex.findOne.mockResolvedValue(existing);

        await indexBoardForSearch("share-1", {});

        expect(existing.title).toBe("Renamed Board");
        expect(existing.save).toHaveBeenCalled();
        expect(SearchIndex.create).not.toHaveBeenCalled();
    });

    it("indexes an empty board (title only, no elements) without throwing", async () => {
        Drawing.findOne.mockResolvedValue({ title: "Untitled" });
        SearchIndex.findOne.mockResolvedValue(null);

        await expect(indexBoardForSearch("share-1", {})).resolves.not.toThrow();
    });

    it("falls back to an empty title when the drawing can't be found", async () => {
        Drawing.findOne.mockRejectedValue(new Error("not found"));
        SearchIndex.findOne.mockResolvedValue(null);

        await indexBoardForSearch("share-1", {});

        expect(SearchIndex.create).toHaveBeenCalledWith(expect.objectContaining({ title: "" }));
    });
});

describe("indexBoardForSearchSafely", () => {
    it("swallows an error instead of throwing", async () => {
        Drawing.findOne.mockRejectedValue(new Error("boom"));
        SearchIndex.findOne.mockRejectedValue(new Error("boom too"));

        await expect(indexBoardForSearchSafely("share-1", {})).resolves.toBeUndefined();
    });
});
