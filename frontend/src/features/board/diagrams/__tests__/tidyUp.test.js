import { describe, it, expect } from "vitest";
import { deriveGraphFromSelection, buildTidyPositionUpdates } from "../tidyUp.js";
import { LAYOUT_DIRECTIONS } from "../layoutEngine.js";

const shape = (startX, startY, endX, endY, extra = {}) => ({
    type: "shape",
    shapeType: "Rectangle",
    startX,
    startY,
    endX,
    endY,
    color: "#000",
    fillColor: null,
    size: 2,
    opacity: 100,
    ...extra,
});
const text = (x, y, width, textValue = "") => ({ type: "text", x, y, width, text: textValue, color: "#000", size: 14 });
const connector = (startElementId, endElementId) => ({
    type: "connector",
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    startElementId,
    endElementId,
    color: "#000",
    size: 2,
    opacity: 100,
    arrowStart: false,
    arrowEnd: true,
});

describe("deriveGraphFromSelection", () => {
    it("treats shapes, text and stickies as nodes", () => {
        const elements = {
            a: shape(0, 0, 100, 100),
            b: text(0, 0, 100, "hello"),
            c: { type: "sticky", x: 0, y: 0, width: 100, height: 100, text: "note" },
        };
        const { nodeIds } = deriveGraphFromSelection(elements, ["a", "b", "c"]);
        expect(nodeIds.sort()).toEqual(["a", "b", "c"]);
    });

    it("excludes paths, images, frames and connectors from the node set", () => {
        const elements = {
            a: shape(0, 0, 100, 100),
            path1: { type: "path", points: [{ x: 0, y: 0 }], size: 1 },
            img1: { type: "image", startX: 0, startY: 0, endX: 10, endY: 10 },
            frame1: { type: "frame", startX: 0, startY: 0, endX: 10, endY: 10 },
            c1: connector("a", null),
        };
        const { nodeIds } = deriveGraphFromSelection(elements, ["a", "path1", "img1", "frame1", "c1"]);
        expect(nodeIds).toEqual(["a"]);
    });

    it("includes a connector as an edge only when both endpoints are selected nodes", () => {
        const elements = { a: shape(0, 0, 100, 100), b: shape(200, 0, 300, 100), c1: connector("a", "b") };
        const { edges } = deriveGraphFromSelection(elements, ["a", "b", "c1"]);
        expect(edges).toEqual([{ from: "a", to: "b" }]);
    });

    it("drops a connector whose other endpoint isn't in the selection", () => {
        const elements = { a: shape(0, 0, 100, 100), b: shape(200, 0, 300, 100), c1: connector("a", "b") };
        const { edges } = deriveGraphFromSelection(elements, ["a", "c1"]);
        expect(edges).toEqual([]);
    });
});

describe("buildTidyPositionUpdates", () => {
    it("returns no updates for an empty selection", () => {
        expect(buildTidyPositionUpdates({}, [], LAYOUT_DIRECTIONS.TOP_DOWN)).toEqual({});
    });

    it("preserves each shape's own size while repositioning it", () => {
        const elements = {
            a: shape(0, 0, 100, 60),
            b: shape(500, 500, 620, 560),
        };
        const updates = buildTidyPositionUpdates(elements, ["a", "b"], LAYOUT_DIRECTIONS.TOP_DOWN);
        expect(updates.a.endX - updates.a.startX).toBeCloseTo(100, 5);
        expect(updates.a.endY - updates.a.startY).toBeCloseTo(60, 5);
        expect(updates.b.endX - updates.b.startX).toBeCloseTo(120, 5);
        expect(updates.b.endY - updates.b.startY).toBeCloseTo(60, 5);
    });

    it("keeps every non-geometry field on a shape untouched", () => {
        const elements = { a: shape(0, 0, 100, 60, { color: "#ff0000", locked: false }) };
        const updates = buildTidyPositionUpdates(elements, ["a"], LAYOUT_DIRECTIONS.TOP_DOWN);
        expect(updates.a.color).toBe("#ff0000");
        expect(updates.a.shapeType).toBe("Rectangle");
    });

    it("recenters the laid-out result on the selection's own original centroid", () => {
        const elements = {
            a: shape(-1000, -1000, -900, -940),
            b: shape(-800, -1000, -700, -940),
        };
        const originalCenterX = (-1000 + -700) / 2;
        const updates = buildTidyPositionUpdates(elements, ["a", "b"], LAYOUT_DIRECTIONS.LEFT_RIGHT);
        const newMinX = Math.min(updates.a.startX, updates.b.startX);
        const newMaxX = Math.max(updates.a.endX, updates.b.endX);
        expect((newMinX + newMaxX) / 2).toBeCloseTo(originalCenterX, 0);
    });

    it("repositions a text element by x/y without touching its stored width", () => {
        const elements = { a: text(0, 0, 140, "Some label") };
        const updates = buildTidyPositionUpdates(elements, ["a"], LAYOUT_DIRECTIONS.TOP_DOWN);
        expect(updates.a.width).toBe(140);
        expect(updates.a.text).toBe("Some label");
    });

    it("only touches selected node-type elements, leaving a selected path/frame/connector out of the update set", () => {
        const elements = {
            a: shape(0, 0, 100, 100),
            b: shape(200, 0, 300, 100),
            c1: connector("a", "b"),
            path1: { type: "path", points: [{ x: 0, y: 0 }], size: 1 },
        };
        const updates = buildTidyPositionUpdates(elements, ["a", "b", "c1", "path1"], LAYOUT_DIRECTIONS.TOP_DOWN);
        expect(Object.keys(updates).sort()).toEqual(["a", "b"]);
    });
});
