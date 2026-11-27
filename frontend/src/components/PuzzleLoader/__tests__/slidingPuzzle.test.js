import { describe, it, expect } from "vitest";
import { scramble, slide, solvedSlots } from "../slidingPuzzle";

describe("sliding puzzle", () => {
    it("solves back to the mark by following its own solution", () => {
        let n = 0;
        const random = () => (n += 0.37) % 1;
        const { slots, solution } = scramble(18, random);
        expect(slots).not.toEqual(solvedSlots());
        expect(solution.reduce(slide, slots)).toEqual(solvedSlots());
    });

    it("only ever slides a tile next to the gap", () => {
        const { slots, solution } = scramble(12);
        let state = slots;
        for (const slot of solution) {
            const gap = state.indexOf(null);
            expect(Math.abs(gap - slot) === 1 || Math.abs(gap - slot) === 4).toBe(true);
            state = slide(state, slot);
        }
    });
});
