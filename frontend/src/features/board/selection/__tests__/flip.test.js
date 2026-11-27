import { describe, expect, it } from "vitest";
import { flipElements } from "../flip";

describe("flipElements", () => {
    const triangle = { type: "shape", shapeType: "Triangle", startX: 0, startY: 0, endX: 100, endY: 50, rotation: 10 };
    const label = { type: "text", x: 200, y: 0, width: 50, text: "hi", size: 16, rotation: 0 };

    it("turns a shape over and mirrors its turn", () => {
        const { a } = flipElements({ a: triangle }, ["a"], "x");
        expect(a).toMatchObject({ startX: 100, endX: 0, rotation: -10 });
    });

    it("moves text across the selection without mirroring its letters", () => {
        const flipped = flipElements({ a: triangle, b: label }, ["a", "b"], "x");
        expect(flipped.b.x).toBe(0);
        expect(flipped.a.startX).toBe(250);
    });

    it("turns an arrow's anchors over with it", () => {
        const arrow = { type: "connector", startX: 0, startY: 0, endX: 0, endY: 100, startAnchor: { x: 0.2, y: 1 }, endAnchor: { t: 0.5 } };
        const { c } = flipElements({ c: arrow }, ["c"], "y");
        expect(c).toMatchObject({ startY: 100, endY: 0, startAnchor: { x: 0.2, y: 0 }, endAnchor: { t: 0.5 } });
    });
});
