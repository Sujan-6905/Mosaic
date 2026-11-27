import { MAX_ZOOM } from "../camera.js";
import { describe, it, expect } from "vitest";
import { cameraToFit, getVisibleElementIds, getOffscreenIndicators } from "../viewport.js";
import { worldToScreen } from "../camera.js";

describe("cameraToFit", () => {
    it("returns null for null bounds", () => {
        expect(cameraToFit(null, 800, 600)).toBeNull();
    });

    it("frames a wide rect by the constraining (width) axis", () => {
        const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 10 };
        const camera = cameraToFit(bounds, 800, 600, 0);
        expect(camera.zoom).toBeCloseTo(1, 4);
        // Bounds center (400, 5) should land at the viewport center.
        const screenCenter = worldToScreen(camera, 400, 5);
        expect(screenCenter.x).toBeCloseTo(400, 3);
        expect(screenCenter.y).toBeCloseTo(300, 3);
    });

    it("clamps to MAX_ZOOM for a tiny/degenerate (single-point) selection", () => {
        const bounds = { minX: 500, minY: 500, maxX: 500, maxY: 500 };
        const camera = cameraToFit(bounds, 800, 600, 0);
        expect(Number.isFinite(camera.zoom)).toBe(true);
        expect(camera.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    });

    it("respects padding by shrinking the available frame", () => {
        const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 400 };
        const noPadding = cameraToFit(bounds, 800, 600, 0);
        const withPadding = cameraToFit(bounds, 800, 600, 100);
        expect(withPadding.zoom).toBeLessThan(noPadding.zoom);
    });
});

describe("getVisibleElementIds", () => {
    it("delegates to the spatial index's queryRect with the viewport bounds", () => {
        const calls = [];
        const fakeIndex = {
            queryRect: (rect) => {
                calls.push(rect);
                return ["a", "b"];
            },
        };
        const camera = { x: 0, y: 0, zoom: 1 };
        const ids = getVisibleElementIds(fakeIndex, camera, 800, 600, 50);
        expect(ids).toEqual(["a", "b"]);
        expect(calls[0]).toEqual({ minX: -50, minY: -50, maxX: 850, maxY: 650 });
    });
});

describe("getOffscreenIndicators", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const viewportWidth = 800;
    const viewportHeight = 600;

    it("omits targets fully inside the viewport", () => {
        const targets = [{ id: "in", bounds: { minX: 100, minY: 100, maxX: 200, maxY: 200 } }];
        expect(getOffscreenIndicators(targets, camera, viewportWidth, viewportHeight)).toEqual([]);
    });

    it("includes a target fully outside the viewport, clamped to the inset edge", () => {
        const targets = [{ id: "far-right", bounds: { minX: 5000, minY: 250, maxX: 5100, maxY: 350 } }];
        const [indicator] = getOffscreenIndicators(targets, camera, viewportWidth, viewportHeight, 24);
        expect(indicator.id).toBe("far-right");
        // Target is due right of viewport center, so the indicator clamps
        // to the right inset edge at the same vertical center.
        expect(indicator.x).toBeCloseTo(viewportWidth - 24, 3);
        expect(indicator.y).toBeCloseTo(viewportHeight / 2, 1);
    });

    it("skips a target with no bounds rather than throwing", () => {
        const targets = [{ id: "no-bounds", bounds: null }];
        expect(getOffscreenIndicators(targets, camera, viewportWidth, viewportHeight)).toEqual([]);
    });
});

describe("cameraToFit without the interactive clamp", () => {
    it("zooms out past the minimum camera zoom so a large board fits a small preview", () => {
        const bounds = { minX: 0, minY: 0, maxX: 40000, maxY: 20000 };
        const camera = cameraToFit(bounds, 400, 200, 0, { clamp: false });
        expect(camera.zoom).toBeCloseTo(0.01);
        expect(cameraToFit(bounds, 400, 200, 0).zoom).toBeGreaterThan(camera.zoom);
    });
});
