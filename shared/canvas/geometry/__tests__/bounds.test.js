import { describe, it, expect } from "vitest";
import { estimateWrappedLineCount } from "../bounds.js";

describe("estimateWrappedLineCount", () => {
    it("returns 1 for text that fits on one line", () => {
        expect(estimateWrappedLineCount("hi", 200, 16)).toBe(1);
    });

    it("grows with longer text at a fixed width", () => {
        const short = estimateWrappedLineCount("a".repeat(10), 100, 16);
        const long = estimateWrappedLineCount("a".repeat(100), 100, 16);
        expect(long).toBeGreaterThan(short);
    });

    it("counts each newline-separated paragraph independently", () => {
        expect(estimateWrappedLineCount("a\nb\nc", 500, 16)).toBe(3);
    });

    it("never returns less than 1, even for empty text", () => {
        expect(estimateWrappedLineCount("", 200, 16)).toBe(1);
    });
});
