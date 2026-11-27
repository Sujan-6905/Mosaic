import { describe, it, expect } from "vitest";
import { getBoundConnectorUpdates, releaseConnectorsFrom, resolveConnectorPolyline } from "../connectors.js";

const box = (minX, minY, maxX, maxY) => ({ type: "shape", startX: minX, startY: minY, endX: maxX, endY: maxY });
const connector = (startElementId, endElementId, coords = {}) => ({
    type: "connector",
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    startElementId,
    endElementId,
    ...coords,
});

describe("getBoundConnectorUpdates", () => {
    it("re-anchors a connector's start to its bound element's new center", () => {
        const elements = { a: box(0, 0, 100, 100), c1: connector("a", null) };
        const updates = getBoundConnectorUpdates(elements, ["a"]);
        expect(updates.c1.startX).toBe(50);
        expect(updates.c1.startY).toBe(50);
    });

    it("re-anchors both ends when both bound elements moved", () => {
        const elements = { a: box(0, 0, 100, 100), b: box(200, 200, 300, 300), c1: connector("a", "b") };
        const updates = getBoundConnectorUpdates(elements, ["a", "b"]);
        expect(updates.c1.startX).toBe(50);
        expect(updates.c1.endX).toBe(250);
    });

    it("ignores connectors bound to elements that didn't change", () => {
        const elements = { a: box(0, 0, 100, 100), b: box(200, 200, 300, 300), c1: connector("a", "b") };
        expect(getBoundConnectorUpdates(elements, ["someOtherId"])).toEqual({});
    });

    it("ignores unbound connectors entirely", () => {
        const elements = { a: box(0, 0, 100, 100), c1: connector(null, null) };
        expect(getBoundConnectorUpdates(elements, ["a"])).toEqual({});
    });

    it("returns nothing for an empty changed-id list", () => {
        const elements = { a: box(0, 0, 100, 100), c1: connector("a", null) };
        expect(getBoundConnectorUpdates(elements, [])).toEqual({});
    });
});

describe("releaseConnectorsFrom", () => {
    it("clears the deleted end's element id but keeps its last coordinates", () => {
        const elements = { c1: connector("a", "b", { startX: 5, startY: 5, endX: 15, endY: 15 }) };
        const updates = releaseConnectorsFrom(elements, ["a"]);
        expect(updates.c1.startElementId).toBeNull();
        expect(updates.c1.endElementId).toBe("b");
        expect(updates.c1.startX).toBe(5);
    });

    it("leaves out a connector deleted along with its ends, so the delete can't bring it back", () => {
        const elements = { c1: connector("a", "b") };
        expect(releaseConnectorsFrom(elements, ["a", "b", "c1"])).toEqual({});
    });

    it("clears both ends when both are deleted together", () => {
        const elements = { c1: connector("a", "b") };
        const updates = releaseConnectorsFrom(elements, ["a", "b"]);
        expect(updates.c1.startElementId).toBeNull();
        expect(updates.c1.endElementId).toBeNull();
    });

    it("no-ops a connector bound to elements not in the deleted set", () => {
        const elements = { c1: connector("a", "b") };
        expect(releaseConnectorsFrom(elements, ["z"])).toEqual({});
    });
});

const endpointsOf = (connector, elements) => {
    const route = resolveConnectorPolyline(connector, elements);
    return { start: route[0], end: route.at(-1) };
};

describe("connector endpoints", () => {
    it("uses stored coordinates for a fully unbound connector", () => {
        const c = connector(null, null, { startX: 1, startY: 2, endX: 3, endY: 4 });
        const { start, end } = endpointsOf(c, {});
        expect(start).toEqual({ x: 1, y: 2 });
        expect(end).toEqual({ x: 3, y: 4 });
    });

    it("clips a bound endpoint to its element's box edge, not its dead center", () => {
        const elements = { a: box(0, 0, 100, 100) };
        const c = connector("a", null, { startX: 50, startY: 50, endX: 300, endY: 50 });
        const { start } = endpointsOf(c, elements);
        // Clipped to the right edge of the box (x=100), not the center (x=50).
        expect(start.x).toBe(100);
        expect(start.y).toBe(50);
    });
});

describe("routed connectors", () => {
    const routed = () =>
        connector("a", "b", {
            startX: 50,
            startY: 50,
            endX: 250,
            endY: 350,
            waypoints: [
                { x: 50, y: 200 },
                { x: 250, y: 200 },
            ],
        });

    it("carries its bends along when both ends move by the same amount", () => {
        const elements = { a: box(10, 20, 110, 120), b: box(210, 320, 310, 420), c1: routed() };
        const updates = getBoundConnectorUpdates(elements, ["a", "b"]);
        expect(updates.c1.waypoints).toEqual([
            { x: 60, y: 220 },
            { x: 260, y: 220 },
        ]);
    });

    it("straightens when only one end moves", () => {
        const elements = { a: box(100, 0, 200, 100), b: box(200, 300, 300, 400), c1: routed() };
        expect(getBoundConnectorUpdates(elements, ["a"]).c1.waypoints).toBeNull();
    });

    it("draws through its bends and leaves each box along the first and last segment", () => {
        const elements = { a: box(0, 0, 100, 100), b: box(200, 300, 300, 400), c1: routed() };
        expect(resolveConnectorPolyline(elements.c1, elements)).toEqual([
            { x: 50, y: 100 },
            { x: 50, y: 200 },
            { x: 250, y: 200 },
            { x: 250, y: 300 },
        ]);
    });

    it("reports the visual endpoints of a routed connector from its route", () => {
        const elements = { a: box(0, 0, 100, 100), b: box(200, 300, 300, 400), c1: routed() };
        expect(endpointsOf(elements.c1, elements)).toEqual({ start: { x: 50, y: 100 }, end: { x: 250, y: 300 } });
    });
});
