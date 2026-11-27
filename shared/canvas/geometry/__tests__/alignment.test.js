import { describe, it, expect } from "vitest";
import {
    getSnapLines,
    computeSnapAdjustment,
    alignLeft,
    alignHCenter,
    alignRight,
    alignTop,
    alignVCenter,
    alignBottom,
    distributeHorizontal,
    distributeVertical,
} from "../alignment.js";

const box = (startX, startY, endX, endY) => ({ type: "shape", startX, startY, endX, endY });

describe("getSnapLines", () => {
    it("collects min/mid/max on both axes for every element with bounds", () => {
        const lines = getSnapLines([box(0, 0, 10, 20), { type: "path", points: [] }]);
        expect(lines.xs).toEqual([0, 5, 10]);
        expect(lines.ys).toEqual([0, 10, 20]);
    });
});

describe("computeSnapAdjustment", () => {
    const snapLines = { xs: [100], ys: [200] };

    it("snaps to whichever of the bounds' own edges is closest to a candidate line, within the threshold", () => {
        // Edges 96/101/106 vs line 100: left is 4 away, mid is 1 away (wins),
        // right is 6 away (outside the threshold=5 anyway).
        const result = computeSnapAdjustment({ minX: 96, minY: 0, maxX: 106, maxY: 10 }, snapLines, 5);
        expect(result.dx).toBe(-1);
        expect(result.snappedX).toBe(100);
    });

    it("ignores a candidate outside the threshold", () => {
        const result = computeSnapAdjustment({ minX: 50, minY: 0, maxX: 60, maxY: 10 }, snapLines, 5);
        expect(result.dx).toBe(0);
        expect(result.snappedX).toBeNull();
    });

    it("picks whichever of the bounds' own three edges is closest to a line", () => {
        // Edges 93/99/105 vs line 100: left is 7 away, mid is 1 away (wins), right is 5 away.
        const result = computeSnapAdjustment({ minX: 93, minY: 0, maxX: 105, maxY: 10 }, snapLines, 10);
        expect(result.dx).toBe(1);
    });
});

describe("align*", () => {
    it("no-ops a selection under 2 elements", () => {
        expect(alignLeft({ a: box(0, 0, 10, 10) }, ["a"])).toEqual({});
    });

    it("alignLeft moves every element's left edge to the selection's own leftmost edge", () => {
        const elements = { a: box(0, 0, 10, 10), b: box(20, 5, 40, 15) };
        const updates = alignLeft(elements, ["a", "b"]);
        expect(updates.a).toBeUndefined(); // already at the union's minX
        expect(updates.b).toMatchObject({ startX: 0, endX: 20 });
    });

    it("alignHCenter centers every element on the selection's shared horizontal midpoint", () => {
        const elements = { a: box(0, 0, 10, 10), b: box(40, 0, 50, 10) };
        // Union spans 0..50, center 25.
        const updates = alignHCenter(elements, ["a", "b"]);
        expect((updates.a.startX + updates.a.endX) / 2).toBeCloseTo(25);
        expect((updates.b.startX + updates.b.endX) / 2).toBeCloseTo(25);
    });

    it("alignRight moves every element's right edge to the selection's own rightmost edge", () => {
        const elements = { a: box(0, 0, 10, 10), b: box(20, 0, 40, 10) };
        const updates = alignRight(elements, ["a", "b"]);
        expect(updates.a).toMatchObject({ startX: 30, endX: 40 });
        expect(updates.b).toBeUndefined();
    });

    it("alignTop/alignVCenter/alignBottom mirror the horizontal variants on the y axis", () => {
        const elements = { a: box(0, 0, 10, 10), b: box(0, 20, 10, 40) };
        expect(alignTop(elements, ["a", "b"]).b).toMatchObject({ startY: 0, endY: 20 });
        expect(alignBottom(elements, ["a", "b"]).a).toMatchObject({ startY: 30, endY: 40 });
        const centered = alignVCenter(elements, ["a", "b"]);
        expect((centered.a.startY + centered.a.endY) / 2).toBeCloseTo((centered.b.startY + centered.b.endY) / 2);
    });
});

describe("distribute*", () => {
    it("no-ops under 3 elements", () => {
        const elements = { a: box(0, 0, 10, 10), b: box(50, 0, 60, 10) };
        expect(distributeHorizontal(elements, ["a", "b"])).toEqual({});
    });

    it("distributeHorizontal evens out the gaps between elements, keeping the extremes fixed", () => {
        // a: 0-10, b: 20-25 (unevenly placed), c: 90-100.
        const elements = { a: box(0, 0, 10, 10), b: box(20, 0, 25, 10), c: box(90, 0, 100, 10) };
        const updates = distributeHorizontal(elements, ["a", "b", "c"]);
        expect(updates.a).toBeUndefined();
        expect(updates.c).toBeUndefined();
        // Total span 0-100, total size 10+5+10=25, 2 gaps -> 37.5 each.
        expect(updates.b.startX).toBeCloseTo(47.5);
        expect(updates.b.endX).toBeCloseTo(52.5);
    });

    it("distributeVertical mirrors the horizontal case on the y axis", () => {
        const elements = { a: box(0, 0, 10, 10), b: box(0, 20, 10, 25), c: box(0, 90, 10, 100) };
        const updates = distributeVertical(elements, ["a", "b", "c"]);
        expect(updates.b.startY).toBeCloseTo(47.5);
    });
});
