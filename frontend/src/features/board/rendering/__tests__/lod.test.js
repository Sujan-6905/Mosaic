import { describe, it, expect } from "vitest";
import {
    getLodLevel,
    isTextLegible,
    shouldHideHandles,
    simplifyPathPoints,
    MIN_LEGIBLE_TEXT_PX,
    MIN_HANDLE_PROJECTION_PX,
    SIMPLIFY_ZOOM_THRESHOLD,
    isSpeck,
    HIDE_FINE_DETAIL_ELEMENT_COUNT,
} from "../lod.js";

describe("threshold constants", () => {
    it("are pinned to their documented values", () => {
        expect(MIN_LEGIBLE_TEXT_PX).toBe(6);
        expect(MIN_HANDLE_PROJECTION_PX).toBe(16);
        expect(SIMPLIFY_ZOOM_THRESHOLD).toBe(0.5);
        expect(HIDE_FINE_DETAIL_ELEMENT_COUNT).toBe(1500);
    });
});

describe("getLodLevel", () => {
    it("stays off at normal zoom with a modest board", () => {
        expect(getLodLevel(1, 50)).toEqual({ simplifyTolerance: null, hideFineDetail: false });
    });

    it("simplifies below the zoom threshold, about a screen pixel at a time", () => {
        expect(getLodLevel(0.5, 10).simplifyTolerance).toBeNull();
        expect(getLodLevel(0.49, 10).simplifyTolerance).toBe(2);
        expect(getLodLevel(0.25, 10).simplifyTolerance).toBe(4);
        expect(getLodLevel(0.1, 10).simplifyTolerance).toBe(8);
    });

    it("flags hideFineDetail above the visible-count threshold", () => {
        expect(getLodLevel(1, 1501).hideFineDetail).toBe(true);
        expect(getLodLevel(1, 1500).hideFineDetail).toBe(false);
    });
});

describe("isTextLegible", () => {
    it("is legible at normal zoom for a normal font size", () => {
        expect(isTextLegible({ size: 16 }, 1)).toBe(true);
    });

    it("becomes illegible once size*zoom drops below the floor", () => {
        expect(isTextLegible({ size: 16 }, 0.1)).toBe(false);
    });

    it("defaults a missing size to 16, matching renderText's own fallback", () => {
        expect(isTextLegible({}, 1)).toBe(true);
    });
});

describe("shouldHideHandles", () => {
    it("hides handles for a bounding box smaller than the floor", () => {
        expect(shouldHideHandles({ minX: 0, minY: 0, maxX: 10, maxY: 10 })).toBe(true);
    });

    it("keeps handles for a bounding box at or above the floor on both axes", () => {
        expect(shouldHideHandles({ minX: 0, minY: 0, maxX: 20, maxY: 20 })).toBe(false);
    });

    it("hides handles when only one axis is undersized", () => {
        expect(shouldHideHandles({ minX: 0, minY: 0, maxX: 200, maxY: 10 })).toBe(true);
    });
});

describe("simplifyPathPoints", () => {
    it("leaves short inputs (fewer than 3 points) untouched", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ];
        expect(simplifyPathPoints(points, 5)).toBe(points);
    });

    it("does not throw on empty or single-point input", () => {
        expect(simplifyPathPoints([], 5)).toEqual([]);
        expect(simplifyPathPoints([{ x: 0, y: 0 }], 5)).toEqual([{ x: 0, y: 0 }]);
    });

    it("always preserves the exact first and last points", () => {
        const points = Array.from({ length: 20 }, (_, i) => ({ x: i, y: Math.sin(i) * 10 }));
        const simplified = simplifyPathPoints(points, 3);
        expect(simplified[0]).toEqual(points[0]);
        expect(simplified.at(-1)).toEqual(points.at(-1));
    });

    it("collapses near-collinear points to just the endpoints", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 5, y: 0.01 },
            { x: 10, y: 0 },
        ];
        expect(simplifyPathPoints(points, 1)).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ]);
    });

    it("keeps a point that deviates beyond tolerance from the baseline", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 5, y: 50 },
            { x: 10, y: 0 },
        ];
        const simplified = simplifyPathPoints(points, 1);
        expect(simplified).toHaveLength(3);
    });

    it("preserves non-coordinate fields (pressure) on every surviving point", () => {
        const points = [
            { x: 0, y: 0, pressure: 0.2 },
            { x: 5, y: 0.01, pressure: 0.9 },
            { x: 10, y: 0, pressure: 0.5 },
        ];
        const simplified = simplifyPathPoints(points, 1);
        expect(simplified.every((p) => "pressure" in p)).toBe(true);
        expect(simplified[0].pressure).toBe(0.2);
        expect(simplified.at(-1).pressure).toBe(0.5);
    });
});

describe("isSpeck", () => {
    it("treats an element at most a couple of pixels on screen as a speck", () => {
        const bounds = { minX: 0, minY: 0, maxX: 20, maxY: 10 };
        expect(isSpeck(bounds, 0.1)).toBe(true);
        expect(isSpeck(bounds, 1)).toBe(false);
    });
});
