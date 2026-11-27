import { describe, it, expect } from "vitest";
import { findContainingFrame, applyFrameMembership, expandWithFrameChildren } from "../frames.js";

const frame = (bounds, zIndex = 0) => ({
    type: "frame",
    startX: bounds.minX,
    startY: bounds.minY,
    endX: bounds.maxX,
    endY: bounds.maxY,
    zIndex,
});
const shape = (bounds, frameId = null) => ({
    type: "shape",
    startX: bounds.minX,
    startY: bounds.minY,
    endX: bounds.maxX,
    endY: bounds.maxY,
    frameId,
});

describe("findContainingFrame", () => {
    it("finds a frame that fully contains the given bounds", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }) };
        expect(findContainingFrame(elements, { minX: 10, minY: 10, maxX: 20, maxY: 20 })).toBe("f1");
    });

    it("returns null when nothing fully contains the bounds", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 10, maxY: 10 }) };
        expect(findContainingFrame(elements, { minX: 5, minY: 5, maxX: 20, maxY: 20 })).toBeNull();
    });

    it("returns null when only partially overlapping", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 10, maxY: 10 }) };
        expect(findContainingFrame(elements, { minX: 5, minY: 5, maxX: 15, maxY: 15 })).toBeNull();
    });

    it("picks the topmost frame by zIndex when bounds are contained by more than one", () => {
        const elements = {
            outer: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }, 0),
            inner: frame({ minX: 50, minY: 50, maxX: 200, maxY: 200 }, 1),
        };
        expect(findContainingFrame(elements, { minX: 60, minY: 60, maxX: 100, maxY: 100 })).toBe("inner");
    });
});

describe("applyFrameMembership", () => {
    it("assigns frameId when a moved element now sits inside a frame", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }), a: shape({ minX: 600, minY: 600, maxX: 610, maxY: 610 }) };
        const moved = shape({ minX: 10, minY: 10, maxX: 20, maxY: 20 });
        const result = applyFrameMembership(elements, { a: moved });
        expect(result.a.frameId).toBe("f1");
    });

    it("clears frameId when a moved element left every frame", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }), a: shape({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, "f1") };
        const moved = shape({ minX: 600, minY: 600, maxX: 610, maxY: 610 }, "f1");
        const result = applyFrameMembership(elements, { a: moved });
        expect(result.a.frameId).toBeNull();
    });

    it("passes frame elements through unchanged", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }) };
        const movedFrame = frame({ minX: 10, minY: 10, maxX: 510, maxY: 510 });
        const result = applyFrameMembership(elements, { f1: movedFrame });
        expect(result.f1).toBe(movedFrame);
    });

    it("returns the same reference when membership doesn't change", () => {
        const elements = { f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }), a: shape({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, "f1") };
        const moved = shape({ minX: 11, minY: 11, maxX: 21, maxY: 21 }, "f1");
        const result = applyFrameMembership(elements, { a: moved });
        expect(result.a).toBe(moved);
    });
});

describe("expandWithFrameChildren", () => {
    it("adds every child of a dragged frame to the id set", () => {
        const elements = {
            f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }),
            a: shape({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, "f1"),
            b: shape({ minX: 30, minY: 30, maxX: 40, maxY: 40 }, "f1"),
            c: shape({ minX: 600, minY: 600, maxX: 610, maxY: 610 }, null),
        };
        const expanded = expandWithFrameChildren(elements, ["f1"]);
        expect(new Set(expanded)).toEqual(new Set(["f1", "a", "b"]));
    });

    it("leaves a non-frame selection untouched", () => {
        const elements = { a: shape({ minX: 0, minY: 0, maxX: 1, maxY: 1 }) };
        expect(expandWithFrameChildren(elements, ["a"])).toEqual(["a"]);
    });

    it("doesn't duplicate an id already present in the selection", () => {
        const elements = {
            f1: frame({ minX: 0, minY: 0, maxX: 500, maxY: 500 }),
            a: shape({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, "f1"),
        };
        const expanded = expandWithFrameChildren(elements, ["f1", "a"]);
        expect(expanded.filter((id) => id === "a")).toHaveLength(1);
    });
});
