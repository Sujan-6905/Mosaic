import { describe, it, expect } from "vitest";
import { shouldScopeToViewport, scopeElementsToViewport, GROUNDING_SIZE_THRESHOLD } from "../viewportScope.js";

const rect = (startX, startY) => ({
    type: "shape",
    shapeType: "rectangle",
    startX,
    startY,
    endX: startX + 20,
    endY: startY + 20,
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
});

const smallBoard = { a: rect(0, 0), b: rect(100, 100) };
const bigBoard = Object.fromEntries(Array.from({ length: GROUNDING_SIZE_THRESHOLD + 1 }, (_, i) => [`el-${i}`, rect(i * 10, i * 10)]));

describe("shouldScopeToViewport", () => {
    it("is false under the size threshold, regardless of viewport", () => {
        expect(shouldScopeToViewport(smallBoard, { minX: 0, minY: 0, maxX: 100, maxY: 100 })).toBe(false);
    });

    it("is false above the threshold with no viewport given", () => {
        expect(shouldScopeToViewport(bigBoard, null)).toBe(false);
    });

    it("is true above the threshold with a viewport given", () => {
        expect(shouldScopeToViewport(bigBoard, { minX: 0, minY: 0, maxX: 100, maxY: 100 })).toBe(true);
    });
});

describe("scopeElementsToViewport", () => {
    it("returns every element unchanged, marked non-partial, when scoping doesn't apply", () => {
        const result = scopeElementsToViewport(smallBoard, { minX: 0, minY: 0, maxX: 50, maxY: 50 });
        expect(result.elements).toBe(smallBoard);
        expect(result.partial).toBe(false);
    });

    it("keeps only elements near the viewport, marked partial, above the size threshold", () => {
        const viewport = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
        const result = scopeElementsToViewport(bigBoard, viewport);

        expect(result.partial).toBe(true);
        expect(Object.keys(result.elements).length).toBeLessThan(Object.keys(bigBoard).length);
        expect(result.elements["el-0"]).toBeDefined(); // at (0,0), inside the viewport
        expect(result.elements[`el-${GROUNDING_SIZE_THRESHOLD}`]).toBeUndefined(); // far outside, even with padding
    });

    it("keeps an element just outside the raw viewport but within the padding margin", () => {
        const viewport = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
        const board = { ...bigBoard, near: rect(600, 600) }; // ~778px away from the viewport edge, under the 800px pad
        const result = scopeElementsToViewport(board, viewport);

        expect(result.elements.near).toBeDefined();
    });
});

describe("scopeElementsToViewport with a board-wide viewport", () => {
    it("falls back to the whole board when the viewport still takes in more than the threshold", () => {
        const everything = { minX: -1e9, minY: -1e9, maxX: 1e9, maxY: 1e9 };
        const result = scopeElementsToViewport(bigBoard, everything);
        expect(result.elements).toBe(bigBoard);
        expect(result.partial).toBe(false);
    });
});
