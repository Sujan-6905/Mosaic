import { describe, it, expect } from "vitest";
import { boundsOfDiff, describeDiffCounts, diffForAcceptedOps, initiallyAcceptedIndexes, staleElementIds } from "../editReview";

const rect = (x, version = 1) => ({ type: "shape", shapeType: "Rectangle", startX: x, startY: 0, endX: x + 10, endY: 10, version });

const diff = {
    added: [{ elementId: "new", element: rect(100) }],
    removed: [{ elementId: "gone", element: rect(200) }],
    moved: [{ elementId: "moved", before: rect(0), after: rect(50) }],
    modified: [{ elementId: "repaired", before: rect(300), after: { ...rect(300), color: "#ff0000" } }],
};

const opsPreview = [
    { index: 0, op: "duplicate", elementIds: ["new"] },
    { index: 1, op: "delete", elementIds: ["gone"] },
    { index: 2, op: "move", elementIds: ["moved"] },
];

describe("initiallyAcceptedIndexes", () => {
    it("leaves deletes unticked", () => {
        expect(initiallyAcceptedIndexes(opsPreview)).toEqual([0, 2]);
    });
});

describe("diffForAcceptedOps", () => {
    it("keeps only what the ticked operations produce", () => {
        const kept = diffForAcceptedOps(diff, opsPreview, [0]);
        expect(kept.added).toHaveLength(1);
        expect(kept.removed).toHaveLength(0);
        expect(kept.moved).toHaveLength(0);
    });

    it("keeps an automatic repair while anything is ticked", () => {
        expect(diffForAcceptedOps(diff, opsPreview, [0]).modified).toHaveLength(1);
        expect(diffForAcceptedOps(diff, opsPreview, []).modified).toHaveLength(0);
    });

    it("keeps an element while any operation that touches it is ticked", () => {
        const shared = [
            { index: 0, op: "move", elementIds: ["moved"] },
            { index: 1, op: "restyle", elementIds: ["moved"] },
        ];
        expect(diffForAcceptedOps(diff, shared, [1]).moved).toHaveLength(1);
        expect(diffForAcceptedOps(diff, shared, []).moved).toHaveLength(0);
    });
});

describe("describeDiffCounts", () => {
    it("names only the kinds of change present", () => {
        expect(describeDiffCounts({ added: [1, 2], removed: [], moved: [1], modified: [] })).toBe("2 added, 1 moved");
    });
});

describe("boundsOfDiff", () => {
    it("covers where changes end up, and can narrow to some of them", () => {
        expect(boundsOfDiff(diff, ["moved"])).toEqual({ minX: 50, minY: 0, maxX: 60, maxY: 10 });
        expect(boundsOfDiff(diff).maxX).toBe(310);
    });
});

describe("staleElementIds", () => {
    const board = { gone: rect(200), moved: rect(0), repaired: rect(300) };

    it("is empty while the board still matches the proposal", () => {
        expect(staleElementIds(diff, board)).toEqual([]);
    });

    it("flags an element someone edited since", () => {
        expect(staleElementIds(diff, { ...board, moved: rect(5, 2) })).toEqual(["moved"]);
    });

    it("flags an element someone deleted since", () => {
        const { gone, ...rest } = board;
        expect(staleElementIds(diff, rest)).toEqual(["gone"]);
    });
});
