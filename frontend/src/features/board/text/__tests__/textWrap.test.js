import { describe, it, expect, vi } from "vitest";
import { wrapTextForRender, getWrappedLines } from "../textWrap.js";

// A fake canvas context whose measureText just counts characters: enough
// to exercise the wrap algorithm's behavior without a real canvas.
const fakeContext = (charWidth = 10) => ({
    measureText: (text) => ({ width: text.length * charWidth }),
});

describe("wrapTextForRender", () => {
    it("keeps a short line intact", () => {
        expect(wrapTextForRender(fakeContext(10), "hello", 200)).toEqual(["hello"]);
    });

    it("wraps at word boundaries once a line exceeds maxWidth", () => {
        // Each word is 5 chars * 10px = 50px; maxWidth 90 fits one word only.
        const lines = wrapTextForRender(fakeContext(10), "alpha bravo charlie", 90);
        expect(lines).toEqual(["alpha", "bravo", "charlie"]);
    });

    it("preserves explicit newlines as paragraph breaks", () => {
        const lines = wrapTextForRender(fakeContext(10), "first\nsecond", 500);
        expect(lines).toEqual(["first", "second"]);
    });

    it("preserves an empty line from a blank paragraph", () => {
        const lines = wrapTextForRender(fakeContext(10), "first\n\nthird", 500);
        expect(lines).toEqual(["first", "", "third"]);
    });

    it("breaks an overlong single word between characters so nothing passes the edge", () => {
        const lines = wrapTextForRender(fakeContext(10), "supercalifragilistic", 50);
        expect(lines).toEqual(["super", "calif", "ragil", "istic"]);
    });
});

describe("getWrappedLines", () => {
    const measuringContext = (font = "16px Arial") => {
        const context = { font, measureText: vi.fn((text) => ({ width: text.length * 10 })) };
        return context;
    };

    it("measures an element once and returns each line's width", () => {
        const element = { text: "one two" };
        const context = measuringContext();
        const lines = getWrappedLines(context, element, 40);
        expect(lines.map(({ text, width }) => ({ text, width }))).toEqual([
            { text: "one", width: 30 },
            { text: "two", width: 30 },
        ]);
        const callsAfterFirst = context.measureText.mock.calls.length;
        expect(getWrappedLines(context, element, 40)).toBe(lines);
        expect(context.measureText.mock.calls.length).toBe(callsAfterFirst);
    });

    it("wraps again when the box width changes", () => {
        const element = { text: "one two" };
        const context = measuringContext();
        const lines = getWrappedLines(context, element, 40);
        expect(getWrappedLines(context, element, 200)).not.toBe(lines);
    });
});
