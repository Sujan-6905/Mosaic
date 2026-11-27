import { describe, it, expect } from "vitest";
import { layoutRichText, richLineToSvg } from "../richTextLayout.js";

// Every glyph is half the font size wide, so widths are easy to reason about.
const fakeContext = () => ({
    font: "",
    measureText(text) {
        const size = Number(/(\d+)px/.exec(this.font)[1]);
        return { width: text.length * size * 0.5 };
    },
});
const base = { size: 10, family: "Inter" };

describe("layoutRichText", () => {
    it("keeps each run's own font and hides the marks", () => {
        const [line] = layoutRichText(fakeContext(), "a **bold** word", Infinity, base);
        expect(line.text).toBe("a bold word");
        expect(line.segments.map((segment) => [segment.text, segment.font])).toEqual([
            ["a ", "10px Inter"],
            ["bold", "bold 10px Inter"],
            [" word", "10px Inter"],
        ]);
        expect(line.segments[1].x).toBe(10);
    });

    it("wraps between words and drops the space a line ends on", () => {
        const lines = layoutRichText(fakeContext(), "one two three", 30, base);
        expect(lines.map((line) => line.text)).toEqual(["one", "two", "three"]);
    });

    it("hangs a list item's wrapped lines after its marker", () => {
        const lines = layoutRichText(fakeContext(), "- alpha beta", 60, base);
        expect(lines[0].marker.text).toBe("•");
        expect(lines[0].indent).toBe(14);
        expect(lines[1]).toMatchObject({ marker: null, indent: 14, text: "beta" });
    });

    it("breaks a word wider than the box between letters", () => {
        const lines = layoutRichText(fakeContext(), "abcdefgh", 20, base);
        expect(lines.map((line) => line.text)).toEqual(["abcd", "efgh"]);
    });

    it("writes links and formatting into SVG", () => {
        const [line] = layoutRichText(fakeContext(), "*see* [docs](https://a.dev)", Infinity, base);
        const svg = richLineToSvg(line, 0, 10, { family: "Inter", size: 10, fill: "#000" });
        expect(svg).toContain('font-style="italic">see</tspan>');
        expect(svg).toContain('<a href="https://a.dev"><tspan');
        expect(svg).toContain('text-decoration="underline">docs</tspan>');
    });
});
