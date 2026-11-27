import { describe, it, expect } from "vitest";
import { buildBoardPreview } from "../boardPreview.js";

describe("buildBoardPreview", () => {
    it("keeps the topmost elements and counts all of them", () => {
        const elements = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`e${i}`, { type: "shape", zIndex: i, startX: i }]));
        const preview = buildBoardPreview(elements);
        expect(preview.count).toBe(400);
        expect(Object.keys(preview.elements)).toHaveLength(300);
        expect(preview.elements.e399).toBeDefined();
        expect(preview.elements.e0).toBeUndefined();
    });

    it("thins long strokes, rounds numbers and cuts long text", () => {
        const points = Array.from({ length: 1000 }, (_, i) => ({ x: i + 0.123456, y: -i * 0.987654, pressure: 0.5 }));
        const { elements } = buildBoardPreview({
            p: { type: "path", points, size: 2.3333 },
            t: { type: "text", text: "x".repeat(500), fontSource: { kind: "google" } },
        });
        expect(elements.p.points).toHaveLength(48);
        expect(elements.p.points[0]).toEqual({ x: 0.1, y: -0 });
        expect(elements.p.points.at(-1)).toEqual({ x: 999.1, y: -986.7 });
        expect(elements.p.size).toBe(2.3);
        expect(elements.t.text).toHaveLength(120);
        expect(elements.t).not.toHaveProperty("fontSource");
    });

    it("is empty for a board with nothing on it", () => {
        expect(buildBoardPreview(undefined)).toEqual({ count: 0, elements: {} });
    });
});
