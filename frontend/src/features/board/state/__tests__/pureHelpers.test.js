import { pushHistoryEntry } from "../useElementMutations.js";
import { describe, it, expect } from "vitest";
import { translateElement, scaleElementAboutAnchor, rotateElementAroundPivot } from "../../../../../../shared/canvas/geometry/elementGeometry.js";
import { getElementBounds, getUnionBounds } from "../../../../../../shared/canvas/geometry/bounds.js";

describe("pushHistoryEntry", () => {
    it("appends to a stack under the cap", () => {
        const stack = [{ type: "insert" }];
        const next = pushHistoryEntry(stack, { type: "delete" });
        expect(next).toEqual([{ type: "insert" }, { type: "delete" }]);
        // Original stack untouched: undo and redo rely on this immutability.
        expect(stack).toHaveLength(1);
    });

    it("drops the oldest entry once the stack hits MAX_HISTORY_SIZE (100)", () => {
        const stack = Array.from({ length: 100 }, (_, i) => ({ n: i }));
        const next = pushHistoryEntry(stack, { n: "new" });
        expect(next).toHaveLength(100);
        expect(next[0]).toEqual({ n: 1 });
        expect(next.at(-1)).toEqual({ n: "new" });
    });
});

describe("getElementBounds", () => {
    it("returns null for a null element", () => {
        expect(getElementBounds(null)).toBeNull();
    });

    it("computes a padded bounding box for a path, padded by half its size", () => {
        const element = {
            type: "path",
            size: 10,
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 20 },
            ],
        };
        expect(getElementBounds(element)).toEqual({ minX: -5, minY: -5, maxX: 15, maxY: 25 });
    });

    it("returns null for a path with no points", () => {
        expect(getElementBounds({ type: "path", points: [] })).toBeNull();
    });

    it("normalizes a shape's bounds regardless of start/end corner order", () => {
        const element = { type: "shape", startX: 50, startY: 50, endX: 0, endY: 0 };
        expect(getElementBounds(element)).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
    });

    it("derives a text element's bounds from its box's top-left corner, stored width and wrapped line count", () => {
        const element = { type: "text", x: 10, y: 20, width: 100, text: "hi", size: 16 };
        const bounds = getElementBounds(element);
        expect(bounds.minX).toBe(10);
        expect(bounds.minY).toBe(20);
        expect(bounds.maxX).toBe(110);
        expect(bounds.maxY).toBeGreaterThan(20);
    });

    it("grows a text element's height estimate for longer wrapped text", () => {
        const short = getElementBounds({ type: "text", x: 0, y: 0, width: 100, text: "hi", size: 16 });
        const long = getElementBounds({ type: "text", x: 0, y: 0, width: 100, text: "a".repeat(400), size: 16 });
        expect(long.maxY - long.minY).toBeGreaterThan(short.maxY - short.minY);
    });

    it("returns a sticky element's box bounds directly", () => {
        const element = { type: "sticky", x: 5, y: 10, width: 200, height: 150 };
        expect(getElementBounds(element)).toEqual({ minX: 5, minY: 10, maxX: 205, maxY: 160 });
    });

    it("treats frame/connector/image the same as a shape's start/end box", () => {
        for (const type of ["frame", "connector", "image"]) {
            const element = { type, startX: 50, startY: 50, endX: 0, endY: 0 };
            expect(getElementBounds(element)).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
        }
    });
});

describe("getUnionBounds", () => {
    it("returns null for an empty list", () => {
        expect(getUnionBounds([])).toBeNull();
    });

    it("unions the bounds of every element, ignoring ones with no bounds", () => {
        const elements = [
            { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10 },
            { type: "shape", startX: 20, startY: -5, endX: 30, endY: 5 },
            { type: "path", points: [] },
        ];
        expect(getUnionBounds(elements)).toEqual({ minX: 0, minY: -5, maxX: 30, maxY: 10 });
    });
});

describe("rotateElementAroundPivot", () => {
    it("rotating about its own center only bumps rotation, with no positional change", () => {
        const element = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, rotation: 0 };
        const rotated = rotateElementAroundPivot(element, 5, 5, 90);
        expect(rotated.startX).toBeCloseTo(0);
        expect(rotated.startY).toBeCloseTo(0);
        expect(rotated.endX).toBeCloseTo(10);
        expect(rotated.endY).toBeCloseTo(10);
        expect(rotated.rotation).toBe(90);
    });

    it("revolves an off-pivot element's position around a shared pivot", () => {
        // A 2x2 box centered at (11, 10), pivoted 90deg around (10, 10) -
        // its center should land at (10, 11).
        const element = { type: "shape", startX: 10, startY: 9, endX: 12, endY: 11, rotation: 0 };
        const rotated = rotateElementAroundPivot(element, 10, 10, 90);
        expect((rotated.startX + rotated.endX) / 2).toBeCloseTo(10);
        expect((rotated.startY + rotated.endY) / 2).toBeCloseTo(11);
        expect(rotated.rotation).toBe(90);
    });

    it("wraps rotation into [0, 360)", () => {
        const element = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, rotation: 300 };
        expect(rotateElementAroundPivot(element, 5, 5, 90).rotation).toBe(30);
        expect(rotateElementAroundPivot(element, 5, 5, -320).rotation).toBe(340);
    });
});

describe("translateElement", () => {
    it("shifts every point of a path", () => {
        const element = {
            type: "path",
            points: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ],
        };
        const moved = translateElement(element, 10, -10);
        expect(moved.points).toEqual([
            { x: 10, y: -10 },
            { x: 15, y: -5 },
        ]);
    });

    it("shifts a shape's start/end corners", () => {
        const element = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10 };
        const moved = translateElement(element, 5, 5);
        expect(moved).toMatchObject({ startX: 5, startY: 5, endX: 15, endY: 15 });
    });

    it("shifts a text element's origin", () => {
        expect(translateElement({ type: "text", x: 1, y: 1 }, 2, 3)).toMatchObject({ x: 3, y: 4 });
    });

    it("shifts a sticky element's origin", () => {
        expect(translateElement({ type: "sticky", x: 1, y: 1 }, 2, 3)).toMatchObject({ x: 3, y: 4 });
    });

    it("preserves a path point's pressure field when translating", () => {
        const element = {
            type: "path",
            points: [
                { x: 0, y: 0, pressure: 0.3 },
                { x: 5, y: 5, pressure: 0.9 },
            ],
        };
        const moved = translateElement(element, 10, 10);
        expect(moved.points).toEqual([
            { x: 10, y: 10, pressure: 0.3 },
            { x: 15, y: 15, pressure: 0.9 },
        ]);
    });
});

describe("scaleElementAboutAnchor", () => {
    it("keeps the anchor point fixed while scaling a shape", () => {
        // Anchor at (0,0), scale the opposite corner (10,10) by 2x -> (20,20).
        const element = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10 };
        const scaled = scaleElementAboutAnchor(element, 0, 0, 2, 2);
        expect(scaled).toMatchObject({ startX: 0, startY: 0, endX: 20, endY: 20 });
    });

    it("only scales the active axis (sy=1 leaves y untouched)", () => {
        const element = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10 };
        const scaled = scaleElementAboutAnchor(element, 0, 0, 2, 1);
        expect(scaled).toMatchObject({ startX: 0, startY: 0, endX: 20, endY: 10 });
    });

    it("scales every point of a path about the anchor", () => {
        const element = { type: "path", points: [{ x: 10, y: 10 }] };
        const scaled = scaleElementAboutAnchor(element, 0, 0, 0.5, 0.5);
        expect(scaled.points).toEqual([{ x: 5, y: 5 }]);
    });

    it("preserves a path point's pressure field when scaling", () => {
        const element = { type: "path", points: [{ x: 10, y: 10, pressure: 0.7 }] };
        const scaled = scaleElementAboutAnchor(element, 0, 0, 0.5, 0.5);
        expect(scaled.points).toEqual([{ x: 5, y: 5, pressure: 0.7 }]);
    });

    it("scales a text box's width, keeping font size fixed", () => {
        const element = { type: "text", x: 0, y: 0, width: 100, size: 16 };
        const scaled = scaleElementAboutAnchor(element, 0, 0, 2, 1);
        expect(scaled).toMatchObject({ x: 0, y: 0, width: 200, size: 16 });
    });

    it("scales a sticky's whole box about the anchor", () => {
        const element = { type: "sticky", x: 0, y: 0, width: 100, height: 100 };
        const scaled = scaleElementAboutAnchor(element, 0, 0, 2, 2);
        expect(scaled).toMatchObject({ x: 0, y: 0, width: 200, height: 200 });
    });
});
