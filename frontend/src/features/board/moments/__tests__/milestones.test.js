import { describe, it, expect } from "vitest";
import { milestoneCrossed, ordinalPiece } from "../milestones";

describe("milestoneCrossed", () => {
    it("marks the hundredth, the five hundredth and each thousandth piece", () => {
        expect(milestoneCrossed(99, 100)).toBe(100);
        expect(milestoneCrossed(499, 501)).toBe(500);
        expect(milestoneCrossed(999, 1000)).toBe(1000);
        expect(milestoneCrossed(2999, 3002)).toBe(3000);
    });

    it("says nothing between marks or when pieces are removed", () => {
        expect(milestoneCrossed(100, 140)).toBeNull();
        expect(milestoneCrossed(1001, 999)).toBeNull();
    });

    it("names the piece in words", () => {
        expect(ordinalPiece(1000)).toBe("thousandth");
        expect(ordinalPiece(4000)).toBe("4 thousandth");
    });
});
