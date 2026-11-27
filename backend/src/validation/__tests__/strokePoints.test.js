import { describe, it, expect } from "vitest";
import { compactStrokePoints, MAX_STROKE_POINTS } from "../../../../shared/canvas/strokes/strokePoints.js";
import { updateCanvasSchema } from "../socketSchemas.js";

const wobble = (count) => Array.from({ length: count }, (_, i) => ({ x: 1234.5678912 + i * 1.3, y: -987.654321 + Math.sin(i / 7) * 40, pressure: 0.4567891 }));
const strokeMessage = (points) => ({
    shareId: "b1",
    operation: "insert",
    elementId: "stroke",
    element: { type: "path", points, color: "#000", size: 2, opacity: 100, zIndex: 1, rotation: 0 },
});

describe("compacting a freehand stroke", () => {
    it("rounds to hundredths and keeps both ends", () => {
        const compact = compactStrokePoints(wobble(50));
        expect(compact[0]).toEqual({ x: 1234.57, y: -987.65, pressure: 0.46 });
        expect(compact.at(-1).x).toBeCloseTo(1234.5678912 + 49 * 1.3, 1);
    });

    it("drops steps too small to see at the current zoom", () => {
        const jitter = Array.from({ length: 100 }, (_, i) => ({ x: i * 0.1, y: 0 }));
        expect(compactStrokePoints(jitter, 1).length).toBeLessThan(25);
        expect(compactStrokePoints(jitter, 10)).toHaveLength(100);
    });

    it("thins a stroke longer than the board accepts down to the limit", () => {
        expect(compactStrokePoints(wobble(MAX_STROKE_POINTS * 2))).toHaveLength(MAX_STROKE_POINTS);
    });

    it("leaves even a maximum-length stroke small enough for the server to accept", () => {
        expect(updateCanvasSchema.safeParse(strokeMessage(compactStrokePoints(wobble(MAX_STROKE_POINTS * 3)))).success).toBe(true);
    });
});
