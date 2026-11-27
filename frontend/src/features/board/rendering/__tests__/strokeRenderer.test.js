import { describe, it, expect, beforeAll, vi } from "vitest";
import {
    getStrokeOutline,
    pressureFromVelocity,
    getStrokePreset,
    fillStrokeOutline,
    resolveStrokePressures,
    getStrokePaths,
    paintStrokePaths,
} from "../strokeRenderer.js";

describe("pressureFromVelocity", () => {
    it("returns an empty array for no points", () => {
        expect(pressureFromVelocity([])).toEqual([]);
    });

    it("assigns mid pressure to a single point", () => {
        const [p] = pressureFromVelocity([{ x: 0, y: 0 }]);
        expect(p.pressure).toBe(0.5);
    });

    it("assigns lower pressure to faster (further-spaced) segments", () => {
        // Slow segment (small step), then a fast segment (huge step).
        const points = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 500, y: 0 },
        ];
        const withPressure = pressureFromVelocity(points);
        expect(withPressure[2].pressure).toBeLessThan(withPressure[1].pressure);
    });

    it("never produces pressure below the visibility floor", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10000, y: 0 },
        ];
        const withPressure = pressureFromVelocity(points);
        expect(withPressure[1].pressure).toBeGreaterThanOrEqual(0.15);
    });
});

describe("getStrokePreset", () => {
    it("returns distinct presets for pencil/pen/highlighter", () => {
        const pencil = getStrokePreset("round");
        const pen = getStrokePreset("square");
        const highlighter = getStrokePreset("butt");
        expect(pencil).not.toEqual(pen);
        expect(pen).not.toEqual(highlighter);
        expect(pencil).not.toEqual(highlighter);
    });

    it("falls back to a default preset for an unknown style", () => {
        expect(getStrokePreset("nonsense")).toEqual(getStrokePreset("round"));
    });
});

describe("getStrokeOutline", () => {
    it("returns an empty outline for fewer than 2 points", () => {
        expect(getStrokeOutline([])).toEqual([]);
        expect(getStrokeOutline([{ x: 0, y: 0 }])).toEqual([]);
    });

    it("produces a non-empty polygon for a real stroke", () => {
        const points = [
            { x: 0, y: 0, pressure: 0.5 },
            { x: 10, y: 5, pressure: 0.7 },
            { x: 20, y: 0, pressure: 0.4 },
            { x: 30, y: 8, pressure: 0.6 },
        ];
        const outline = getStrokeOutline(points, { size: 6, style: "round" });
        expect(outline.length).toBeGreaterThan(2);
        outline.forEach((p) => {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
        });
    });

    it("defaults missing per-point pressure to 0.5 rather than throwing", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 },
        ];
        expect(() => getStrokeOutline(points, { size: 4, style: "square" })).not.toThrow();
    });

    it("produces visibly different outlines for different tool presets on the same input", () => {
        const points = [
            { x: 0, y: 0, pressure: 0.2 },
            { x: 20, y: 10, pressure: 0.9 },
            { x: 40, y: 0, pressure: 0.2 },
        ];
        const pencilOutline = getStrokeOutline(points, { size: 10, style: "round" });
        const highlighterOutline = getStrokeOutline(points, { size: 10, style: "butt" });
        expect(pencilOutline).not.toEqual(highlighterOutline);
    });
});

describe("resolveStrokePressures", () => {
    it("uses rawPressure directly when the stroke has real pressure", () => {
        const points = [
            { x: 0, y: 0, rawPressure: 0.2 },
            { x: 5, y: 5, rawPressure: 0.8 },
        ];
        const resolved = resolveStrokePressures(points, true);
        expect(resolved).toEqual([
            { x: 0, y: 0, pressure: 0.2 },
            { x: 5, y: 5, pressure: 0.8 },
        ]);
    });

    it("falls back to velocity-derived pressure when the stroke has no real pressure", () => {
        const points = [
            { x: 0, y: 0, rawPressure: 0.5 },
            { x: 1000, y: 0, rawPressure: 0.5 },
        ];
        const resolved = resolveStrokePressures(points, false);
        // The fast (large) second segment gets lower pressure than the
        // stationary first point: real pressure ignored entirely.
        expect(resolved[1].pressure).toBeLessThan(resolved[0].pressure);
    });
});

describe("fillStrokeOutline", () => {
    it("does nothing for a degenerate (under 3 point) outline", () => {
        const calls = [];
        const fakeContext = { beginPath: () => calls.push("beginPath"), moveTo: () => {}, lineTo: () => {}, closePath: () => {}, fill: () => {} };
        fillStrokeOutline(fakeContext, [{ x: 0, y: 0 }]);
        expect(calls).toEqual([]);
    });

    it("traces moveTo then lineTo per remaining point, then closes and fills", () => {
        const calls = [];
        const fakeContext = {
            beginPath: () => calls.push("beginPath"),
            moveTo: (x, y) => calls.push(`moveTo(${x},${y})`),
            lineTo: (x, y) => calls.push(`lineTo(${x},${y})`),
            closePath: () => calls.push("closePath"),
            fill: () => calls.push("fill"),
        };
        fillStrokeOutline(fakeContext, [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 0 },
        ]);
        expect(calls).toEqual(["beginPath", "moveTo(0,0)", "lineTo(1,1)", "lineTo(2,0)", "closePath", "fill"]);
    });
});

describe("getStrokePaths", () => {
    beforeAll(() => {
        globalThis.Path2D = class {
            moveTo() {}
            lineTo() {}
            closePath() {}
        };
    });

    const stroke = (extra = {}) => ({
        type: "path",
        size: 4,
        points: Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: (i % 2) * 5, pressure: 0.5 })),
        ...extra,
    });

    it("builds each detail level once per element", () => {
        const element = stroke();
        const full = getStrokePaths(element);
        expect(getStrokePaths(element)).toBe(full);
        const simplified = getStrokePaths(element, 4);
        expect(simplified).not.toBe(full);
        expect(getStrokePaths(element, 4)).toBe(simplified);
    });

    it("rebuilds for the replacement element an edit produces", () => {
        const element = stroke();
        expect(getStrokePaths({ ...element })).not.toBe(getStrokePaths(element));
    });

    it("only builds an interior for a stroke with a fill", () => {
        expect(getStrokePaths(stroke()).interior).toBeNull();
        expect(getStrokePaths(stroke({ fillColor: "#ff0000" })).interior).not.toBeNull();
    });

    it("paints the interior under the line, each in its own colour", () => {
        const fills = [];
        const context = { fillStyle: null, fill: vi.fn((path) => fills.push([context.fillStyle, path])) };
        paintStrokePaths(context, { outline: "line", interior: "inside" }, "#111111", "#ff0000");
        expect(fills).toEqual([
            ["#ff0000", "inside"],
            ["#111111", "line"],
        ]);
    });
});
