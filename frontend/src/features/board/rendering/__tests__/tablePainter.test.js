import { describe, it, expect } from "vitest";
import { newTableFields } from "../../text/tableLayout.js";
import { tableToSvg } from "../tablePainter.js";

const table = (tableStyle) => ({
    ...newTableFields({ x: 0, y: 0, width: 300, height: 160 }, { rows: 4, cols: 2, cells: ["Name", "Role", "a", "b", "c", "d", "e", "f"] }),
    tableStyle,
});

const count = (svg, pattern) => svg.match(pattern)?.length ?? 0;

describe("tableToSvg styles", () => {
    it("draws every rule and a frame for the grid", () => {
        const svg = tableToSvg(table("grid"));
        expect(count(svg, /<line /g)).toBe(3 + 1);
        expect(count(svg, /fill="none"/g)).toBe(1);
    });

    it("bands alternate body rows and drops the column rules when striped", () => {
        const svg = tableToSvg(table("striped"));
        expect(count(svg, /<line /g)).toBe(3);
        expect(count(svg, /fill-opacity="0.06"/g)).toBe(1);
    });

    it("keeps only horizontal rules and no frame for lines only", () => {
        const svg = tableToSvg(table("lines"));
        expect(count(svg, /fill="none"/g)).toBe(0);
        expect(count(svg, /<line /g)).toBe(3 + 2);
    });

    it("fills the header with ink and writes its words in the fill colour for bold", () => {
        const svg = tableToSvg(table("bold"));
        expect(svg).toContain('fill-opacity="1"');
        expect(svg).toMatch(/<text[^>]*fill="(#fff|#ffffff|white|rgb\(255)/i);
    });
});
