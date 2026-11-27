import { describe, it, expect } from "vitest";
import { classifyStroke, rdpSimplify, pathLength, describeStroke } from "../shapeRecognizer.js";

// Deterministic point generators: no Math.random() in the assertions
// themselves, so a failure always reproduces exactly.
const circlePoints = (steps = 40, radius = 50, cx = 100, cy = 100) =>
    Array.from({ length: steps + 1 }, (_, i) => {
        const a = (i / steps) * Math.PI * 2;
        return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
    });

const ellipsePoints = (steps = 40, rx = 80, ry = 30, cx = 100, cy = 100) =>
    Array.from({ length: steps + 1 }, (_, i) => {
        const a = (i / steps) * Math.PI * 2;
        return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });

const polygonPoints = (corners, pointsPerEdge = 10) => {
    const points = [];
    for (let i = 0; i < corners.length - 1; i++) {
        const [x1, y1] = corners[i];
        const [x2, y2] = corners[i + 1];
        for (let t = 0; t <= 1; t += 1 / pointsPerEdge) {
            points.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
        }
    }
    return points;
};

describe("classifyStroke", () => {
    it("recognizes a circle", () => {
        const result = classifyStroke(circlePoints());
        expect(result?.shapeType).toBe("Circle");
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("recognizes an eccentric ellipse (not a circle)", () => {
        const result = classifyStroke(ellipsePoints());
        expect(result?.shapeType).toBe("Ellipse");
    });

    it("recognizes a rectangle", () => {
        const rect = polygonPoints([
            [0, 0],
            [200, 0],
            [200, 100],
            [0, 100],
            [0, 0],
        ]);
        const result = classifyStroke(rect);
        expect(result?.shapeType).toBe("Rectangle");
        expect(result.bounds).toEqual({ startX: 0, startY: 0, endX: 200, endY: 100 });
    });

    it("recognizes a triangle", () => {
        const tri = polygonPoints([
            [100, 0],
            [200, 150],
            [0, 150],
            [100, 0],
        ]);
        const result = classifyStroke(tri);
        expect(result?.shapeType).toBe("Triangle");
    });

    it("recognizes a straight line", () => {
        const line = Array.from({ length: 21 }, (_, i) => ({ x: i * 10, y: i * 10 }));
        const result = classifyStroke(line);
        expect(result?.shapeType).toBe("Line");
        expect(result.bounds).toEqual({ startX: 0, startY: 0, endX: 200, endY: 200 });
    });

    it("leaves a scribble (random walk) unrecognized", () => {
        let x = 0,
            y = 0;
        // Fixed pseudo-random-ish sequence, not Math.random(): deterministic.
        const scribble = [{ x, y }];
        for (let i = 0; i < 40; i++) {
            x += Math.sin(i * 12.9898) * 15;
            y += Math.cos(i * 78.233) * 15;
            scribble.push({ x, y });
        }
        expect(classifyStroke(scribble)).toBeNull();
    });

    it("returns null for too few points", () => {
        expect(
            classifyStroke([
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ]),
        ).toBeNull();
    });

    it("returns null for a tiny stroke (a click, not a drag)", () => {
        const tiny = Array.from({ length: 10 }, (_, i) => ({ x: i * 0.1, y: 0 }));
        expect(classifyStroke(tiny)).toBeNull();
    });

    it("never mistakes an open (non-closed) wobble for a shape", () => {
        // A gentle open curve: not straight enough for a line, not closed
        // enough for a polygon/round shape.
        const openCurve = Array.from({ length: 20 }, (_, i) => ({
            x: i * 10,
            y: Math.sin(i / 2) * 40,
        }));
        const result = classifyStroke(openCurve);
        // Either null, or (if flat enough) a line: never a closed-shape type.
        if (result) {
            expect(result.shapeType).toBe("Line");
        }
    });
});

describe("rdpSimplify", () => {
    it("collapses a straight line to its two endpoints", () => {
        const points = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
        expect(rdpSimplify(points, 1)).toEqual([
            { x: 0, y: 0 },
            { x: 9, y: 0 },
        ]);
    });

    it("keeps a genuine corner", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];
        const simplified = rdpSimplify(points, 1);
        expect(simplified).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ]);
    });
});

describe("pathLength", () => {
    it("sums straight-line segment lengths", () => {
        expect(
            pathLength([
                { x: 0, y: 0 },
                { x: 3, y: 4 },
                { x: 3, y: 8 },
            ]),
        ).toBe(9);
    });

    it("is zero for a single point", () => {
        expect(pathLength([{ x: 5, y: 5 }])).toBe(0);
    });
});

describe("describeStroke", () => {
    const roughBox = [
        { x: 0, y: 0 },
        { x: 50, y: 3 },
        { x: 100, y: 0 },
        { x: 102, y: 40 },
        { x: 100, y: 80 },
        { x: 50, y: 78 },
        { x: 0, y: 80 },
        { x: 3, y: 40 },
        { x: 4, y: 10 },
    ];

    it("reads a box with a gap in it as a box, where the strict recogniser wouldn't commit", () => {
        expect(describeStroke(roughBox)).toMatchObject({ kind: "closed", shapeType: "Rectangle" });
    });

    it("reads a straight stroke as a line and keeps its direction", () => {
        const stroke = describeStroke([
            { x: 0, y: 0 },
            { x: 50, y: 1 },
            { x: 100, y: 0 },
        ]);
        expect(stroke.kind).toBe("line");
        expect(stroke.end).toEqual({ x: 100, y: 0 });
    });

    it("tells a diamond from a box", () => {
        const diamond = [
            { x: 50, y: 0 },
            { x: 75, y: 25 },
            { x: 100, y: 50 },
            { x: 75, y: 75 },
            { x: 50, y: 100 },
            { x: 25, y: 75 },
            { x: 0, y: 50 },
            { x: 25, y: 25 },
            { x: 48, y: 2 },
        ];
        expect(describeStroke(diamond)).toMatchObject({ kind: "closed", shapeType: "Diamond" });
    });

    it("calls a dot a dot and ignores too few points", () => {
        expect(
            describeStroke([
                { x: 1, y: 1 },
                { x: 2, y: 1 },
            ]).kind,
        ).toBe("dot");
        expect(describeStroke([{ x: 1, y: 1 }])).toBeNull();
    });

    it("stays cheap on a very long stroke", () => {
        const long = Array.from({ length: 10000 }, (_, i) => ({ x: i, y: Math.sin(i / 50) * 40 }));
        expect(describeStroke(long)).not.toBeNull();
    });
});
