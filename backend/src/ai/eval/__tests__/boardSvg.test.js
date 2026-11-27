import { describe, expect, it } from "vitest";
import { renderBoardSvg } from "../boardSvg.js";

const box = (id, x) => ({ id, type: "shape", shapeType: "Rectangle", x, y: 0, width: 100, height: 60, fillColor: "#ffffff" });

describe("renderBoardSvg", () => {
    const connector = {
        id: "c",
        type: "connector",
        startElementId: "a",
        endElementId: "b",
        fillColor: "#ffffff",
        arrowEnd: true,
        waypoints: [
            { x: 50, y: 120 },
            { x: 350, y: 120 },
        ],
    };
    const svg = renderBoardSvg({ a: box("a", 0), b: box("b", 300), c: connector });

    it("states each attribute once, so the image loads outside a page", () => {
        const tags = svg.match(/<[a-z]+ [^>]*>/g);
        tags.forEach((tag) => {
            const names = [...tag.matchAll(/ ([a-z-]+)="/g)].map((match) => match[1]);
            expect(new Set(names).size).toBe(names.length);
        });
    });

    it("draws a routed connector through its bends, unfilled", () => {
        const line = svg.match(/<polyline points="([^"]+)" ([^>]+)\/>/);
        expect(line[1].split(" ")).toHaveLength(4);
        expect(line[1]).toContain("50,120 350,120");
        expect(line[2]).toContain('fill="none"');
    });
});
