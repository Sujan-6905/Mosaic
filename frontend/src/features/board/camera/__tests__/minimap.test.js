import { describe, it, expect } from "vitest";
import { computeMinimapProjection, projectWorldToMinimap, projectMinimapToWorld } from "../minimap.js";

describe("computeMinimapProjection", () => {
    it("returns null when there's no content", () => {
        expect(computeMinimapProjection(null, 180, 140)).toBeNull();
    });

    it("centers a square content region in a square minimap", () => {
        const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        const projection = computeMinimapProjection(bounds, 120, 120, 10);
        const topLeft = projectWorldToMinimap(projection, 0, 0);
        const bottomRight = projectWorldToMinimap(projection, 100, 100);
        expect(topLeft.x).toBeCloseTo(10, 3);
        expect(topLeft.y).toBeCloseTo(10, 3);
        expect(bottomRight.x).toBeCloseTo(110, 3);
        expect(bottomRight.y).toBeCloseTo(110, 3);
    });

    it("fits a wide content region by the constraining axis and centers the other", () => {
        const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 100 };
        const projection = computeMinimapProjection(bounds, 200, 100, 0);
        expect(projection.scale).toBeCloseTo(0.2, 4);
        // Height 100 * scale 0.2 = 20, centered in 100 -> 40px margin top/bottom.
        const topLeft = projectWorldToMinimap(projection, 0, 0);
        expect(topLeft.y).toBeCloseTo(40, 3);
    });
});

describe("projectWorldToMinimap / projectMinimapToWorld", () => {
    it("round-trips through a projection", () => {
        const bounds = { minX: -500, minY: 200, maxX: 1500, maxY: 900 };
        const projection = computeMinimapProjection(bounds, 180, 140, 8);
        const world = { x: 300, y: 450 };
        const minimapPoint = projectWorldToMinimap(projection, world.x, world.y);
        const back = projectMinimapToWorld(projection, minimapPoint.x, minimapPoint.y);
        expect(back.x).toBeCloseTo(world.x, 6);
        expect(back.y).toBeCloseTo(world.y, 6);
    });
});
