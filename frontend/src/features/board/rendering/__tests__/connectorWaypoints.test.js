import { describe, it, expect } from "vitest";
import { translateElement, scaleElementAboutAnchor } from "../../../../../../shared/canvas/geometry/elementGeometry.js";
import { getElementBounds } from "../../../../../../shared/canvas/geometry/bounds.js";

const routed = {
    type: "connector",
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 0,
    startElementId: null,
    endElementId: null,
    waypoints: [
        { x: 0, y: -80 },
        { x: 100, y: -80 },
    ],
};

describe("connector waypoints in element geometry", () => {
    it("includes bends in the connector's bounds so a detour isn't culled", () => {
        expect(getElementBounds(routed)).toEqual({ minX: 0, minY: -80, maxX: 100, maxY: 0 });
    });

    it("moves bends with the connector", () => {
        expect(translateElement(routed, 10, 5).waypoints).toEqual([
            { x: 10, y: -75 },
            { x: 110, y: -75 },
        ]);
    });

    it("scales bends about the same anchor as the endpoints", () => {
        expect(scaleElementAboutAnchor(routed, 0, 0, 2, 0.5).waypoints).toEqual([
            { x: 0, y: -40 },
            { x: 200, y: -40 },
        ]);
    });

    it("leaves a straight connector without a waypoints field", () => {
        const { waypoints, ...straight } = routed;
        expect(translateElement(straight, 1, 1)).not.toHaveProperty("waypoints");
    });
});
