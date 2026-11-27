import { describe, it, expect } from "vitest";
import { pointInPolygon, getElementsInLasso } from "../lassoSelect.js";

const square = (x0, y0, x1, y1) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
];

describe("pointInPolygon", () => {
    it("reports a point inside a convex polygon", () => {
        expect(pointInPolygon({ x: 5, y: 5 }, square(0, 0, 10, 10))).toBe(true);
    });

    it("reports a point outside a convex polygon", () => {
        expect(pointInPolygon({ x: 15, y: 5 }, square(0, 0, 10, 10))).toBe(false);
    });

    it("reports a point inside a concave (star-shaped) polygon", () => {
        // A plus/cross shape: (5, 1) is inside one of its arms, (1, 1) is
        // inside the notch cut out of the corner.
        const plus = [
            { x: 3, y: 0 },
            { x: 7, y: 0 },
            { x: 7, y: 3 },
            { x: 10, y: 3 },
            { x: 10, y: 7 },
            { x: 7, y: 7 },
            { x: 7, y: 10 },
            { x: 3, y: 10 },
            { x: 3, y: 7 },
            { x: 0, y: 7 },
            { x: 0, y: 3 },
            { x: 3, y: 3 },
        ];
        expect(pointInPolygon({ x: 5, y: 1 }, plus)).toBe(true);
        expect(pointInPolygon({ x: 1, y: 1 }, plus)).toBe(false);
    });
});

describe("getElementsInLasso", () => {
    const elements = {
        inside: { type: "shape", startX: 2, startY: 2, endX: 4, endY: 4 }, // center (3,3)
        outside: { type: "shape", startX: 20, startY: 20, endX: 24, endY: 24 }, // center (22,22)
        noBounds: { type: "path", points: [] },
    };

    it("keeps only candidates whose bounds-center falls inside the polygon", () => {
        const selected = getElementsInLasso(elements, ["inside", "outside", "noBounds"], square(0, 0, 10, 10));
        expect(selected).toEqual(["inside"]);
    });

    it("returns nothing for a degenerate (fewer than 3 point) polygon", () => {
        expect(
            getElementsInLasso(
                elements,
                ["inside"],
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            ),
        ).toEqual([]);
    });
});
