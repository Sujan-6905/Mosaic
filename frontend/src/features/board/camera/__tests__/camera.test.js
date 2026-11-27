import { describe, it, expect } from "vitest";
import {
    worldToScreen,
    screenToWorld,
    zoomAtScreenPoint,
    panByScreenDelta,
    clampZoom,
    viewportWorldBounds,
    MIN_ZOOM,
    MAX_ZOOM,
    MAX_CAMERA_COORDINATE,
} from "../camera.js";

describe("worldToScreen / screenToWorld", () => {
    it("round-trips for an arbitrary camera", () => {
        const camera = { x: 120, y: -45, zoom: 1.75 };
        const world = { x: 900, y: 300 };
        const screen = worldToScreen(camera, world.x, world.y);
        const back = screenToWorld(camera, screen.x, screen.y);
        expect(back.x).toBeCloseTo(world.x, 6);
        expect(back.y).toBeCloseTo(world.y, 6);
    });

    it("round-trips at the camera-coordinate clamp boundary", () => {
        const camera = { x: MAX_CAMERA_COORDINATE, y: -MAX_CAMERA_COORDINATE, zoom: 1 };
        const world = { x: MAX_CAMERA_COORDINATE + 500, y: -MAX_CAMERA_COORDINATE - 500 };
        const screen = worldToScreen(camera, world.x, world.y);
        const back = screenToWorld(camera, screen.x, screen.y);
        expect(back.x).toBeCloseTo(world.x, 3);
        expect(back.y).toBeCloseTo(world.y, 3);
    });

    it("places the camera's own (x, y) at the screen origin", () => {
        const camera = { x: 500, y: 500, zoom: 2 };
        expect(worldToScreen(camera, 500, 500)).toEqual({ x: 0, y: 0 });
    });
});

describe("zoomAtScreenPoint", () => {
    it("keeps the world point under the cursor fixed on screen across a zoom change", () => {
        const camera = { x: 0, y: 0, zoom: 1 };
        const screenPoint = { x: 300, y: 200 };
        const worldUnderCursorBefore = screenToWorld(camera, screenPoint.x, screenPoint.y);

        const next = zoomAtScreenPoint(camera, screenPoint.x, screenPoint.y, 2.5);
        const worldUnderCursorAfter = screenToWorld(next, screenPoint.x, screenPoint.y);

        expect(worldUnderCursorAfter.x).toBeCloseTo(worldUnderCursorBefore.x, 6);
        expect(worldUnderCursorAfter.y).toBeCloseTo(worldUnderCursorBefore.y, 6);
    });

    it("clamps the requested zoom to [MIN_ZOOM, MAX_ZOOM]", () => {
        const camera = { x: 0, y: 0, zoom: 1 };
        expect(zoomAtScreenPoint(camera, 0, 0, 100).zoom).toBe(MAX_ZOOM);
        expect(zoomAtScreenPoint(camera, 0, 0, 0.01).zoom).toBe(MIN_ZOOM);
    });

    it("holds anchor precision across a range of zoom levels", () => {
        const camera = { x: 1000, y: -500, zoom: 1 };
        const screenPoint = { x: 640, y: 400 };
        for (const targetZoom of [0.8, 1.2, 2, 3, 4]) {
            const worldBefore = screenToWorld(camera, screenPoint.x, screenPoint.y);
            const next = zoomAtScreenPoint(camera, screenPoint.x, screenPoint.y, targetZoom);
            const worldAfter = screenToWorld(next, screenPoint.x, screenPoint.y);
            expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
            expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
        }
    });
});

describe("panByScreenDelta", () => {
    it("moves content by exactly the screen-pixel delta at 100% zoom", () => {
        const camera = { x: 0, y: 0, zoom: 1 };
        const next = panByScreenDelta(camera, 50, -30);
        // A rightward screen drag (+dx) should reveal content to the left,
        // i.e. decrease camera.x: matches the pre-camera CSS-transform feel.
        expect(next.x).toBeCloseTo(-50, 6);
        expect(next.y).toBeCloseTo(30, 6);
    });

    it("scales the world-space pan by the inverse of zoom", () => {
        const camera = { x: 0, y: 0, zoom: 2 };
        const next = panByScreenDelta(camera, 100, 0);
        expect(next.x).toBeCloseTo(-50, 6);
    });

    it("leaves zoom untouched", () => {
        const camera = { x: 0, y: 0, zoom: 1.5 };
        expect(panByScreenDelta(camera, 10, 10).zoom).toBe(1.5);
    });
});

describe("clampZoom", () => {
    it("passes through values inside the range", () => {
        expect(clampZoom(2)).toBe(2);
    });
    it("clamps below MIN_ZOOM and above MAX_ZOOM", () => {
        expect(clampZoom(0)).toBe(MIN_ZOOM);
        expect(clampZoom(999)).toBe(MAX_ZOOM);
    });
});

describe("viewportWorldBounds", () => {
    it("computes the visible world rect at 100% zoom with no margin", () => {
        const camera = { x: 10, y: 20, zoom: 1 };
        expect(viewportWorldBounds(camera, 800, 600)).toEqual({ minX: 10, minY: 20, maxX: 810, maxY: 620 });
    });

    it("expands the rect by margin/zoom on every side", () => {
        const camera = { x: 0, y: 0, zoom: 2 };
        const bounds = viewportWorldBounds(camera, 800, 600, 100);
        expect(bounds.minX).toBeCloseTo(-50, 6);
        expect(bounds.minY).toBeCloseTo(-50, 6);
        expect(bounds.maxX).toBeCloseTo(450, 6);
        expect(bounds.maxY).toBeCloseTo(350, 6);
    });
});
