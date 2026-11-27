import { describe, it, expect } from "vitest";
import { buildElementsFromSketch } from "../sketchStrokes.js";

const build = (parts) => {
    let id = 0;
    return buildElementsFromSketch({ parts, targetCenterX: 500, targetCenterY: 300, color: "#123456", zIndexBase: 10, generateElementId: () => `e${id++}` });
};

const part = (name, strokes, fill = null) => ({ name, fill, strokes });
const line = (points, extra = {}) => ({ points, closed: false, smooth: false, ...extra });

describe("buildElementsFromSketch", () => {
    it("makes one ordinary pen stroke per drawn stroke, in order, labelled with its part", () => {
        const elements = build([
            part("roof", [
                line([
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                ]),
            ]),
            part("door", [
                line([
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                ]),
                line([
                    { x: 10, y: 10 },
                    { x: 20, y: 20 },
                ]),
            ]),
        ]);
        expect(elements.map(({ element }) => element.type)).toEqual(["path", "path", "path"]);
        expect(elements.map(({ element }) => element.label)).toEqual(["roof", "door", "door"]);
        expect(elements.map(({ element }) => element.zIndex)).toEqual([11, 12, 13]);
        expect(elements[0].element.color).toBe("#123456");
    });

    it("fills a closed part and leaves unfilled parts without a fill", () => {
        const closed = line(
            [
                { x: 0, y: 0 },
                { x: 9, y: 0 },
                { x: 9, y: 9 },
            ],
            { closed: true },
        );
        const [filled, plain] = build([part("roof", [closed], "#c0392b"), part("door", [closed])]);
        expect(filled.element.fillColor).toBe("#c0392b");
        expect(plain.element).not.toHaveProperty("fillColor");
    });

    it("gives an open line its part's colour as ink, since it has no inside to fill", () => {
        const [{ element }] = build([
            part(
                "whisker",
                [
                    line([
                        { x: 0, y: 0 },
                        { x: 9, y: 9 },
                    ]),
                ],
                "#c0392b",
            ),
        ]);
        expect(element.color).toBe("#c0392b");
        expect(element).not.toHaveProperty("fillColor");
    });

    it("marks every stroke as one sketch with its title", () => {
        const elements = buildElementsFromSketch({
            parts: [
                part("a", [
                    line([
                        { x: 0, y: 0 },
                        { x: 9, y: 9 },
                    ]),
                ]),
                part("b", [
                    line([
                        { x: 1, y: 1 },
                        { x: 8, y: 8 },
                    ]),
                ]),
            ],
            title: "a cute dog",
            targetCenterX: 0,
            targetCenterY: 0,
            color: "#000000",
            zIndexBase: 0,
            generateElementId: () => "same-id",
        });
        expect(elements.map(({ element }) => element.sketchTitle)).toEqual(["a cute dog", "a cute dog"]);
        expect(elements[0].element.sketchId).toBe(elements[1].element.sketchId);
    });

    it("centres the 0 to 100 space on the target", () => {
        const [{ element }] = build([
            part("a", [
                line([
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                ]),
            ]),
        ]);
        const { points } = element;
        expect((points[0].x + points.at(-1).x) / 2).toBeCloseTo(500);
        expect((points[0].y + points.at(-1).y) / 2).toBeCloseTo(300);
    });

    it("smooths a curve and returns a closed one to its start", () => {
        const [{ element }] = build([
            part("a", [
                {
                    points: [
                        { x: 10, y: 10 },
                        { x: 20, y: 10 },
                        { x: 20, y: 20 },
                    ],
                    closed: true,
                    smooth: true,
                },
            ]),
        ]);
        expect(element.points.length).toBeGreaterThan(3);
        expect(element.points.at(-1).x).toBeCloseTo(element.points[0].x);
        expect(element.points.at(-1).y).toBeCloseTo(element.points[0].y);
    });

    it("keeps the corners of a straight-sided shape", () => {
        const corners = [
            { x: 10, y: 10 },
            { x: 90, y: 10 },
            { x: 90, y: 90 },
        ];
        const [{ element }] = build([part("a", [{ points: corners, closed: true, smooth: false }])]);
        const toWorld = ({ x, y }) => ({ x: 500 - 210 + x * 4.2, y: 300 - 210 + y * 4.2 });
        corners.map(toWorld).forEach((corner) => {
            const nearest = Math.min(...element.points.map((point) => Math.hypot(point.x - corner.x, point.y - corner.y)));
            expect(nearest).toBeLessThan(0.01);
        });
    });

    it("draws the same strokes every time, so a preview matches what gets placed", () => {
        const parts = [
            part("a", [
                {
                    points: [
                        { x: 10, y: 10 },
                        { x: 90, y: 10 },
                        { x: 90, y: 90 },
                    ],
                    closed: true,
                    smooth: false,
                },
            ]),
        ];
        expect(build(parts)[0].element.points).toEqual(build(parts)[0].element.points);
    });
});
