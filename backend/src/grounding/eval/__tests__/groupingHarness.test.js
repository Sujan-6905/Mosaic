import { describe, it, expect } from "vitest";
import { runGroupingBenchmark } from "../groupingHarness.js";

// Grouping accuracy on the fixtures, including that the temporal signal beats proximity alone.
describe("grouping accuracy", () => {
    it("scores every configuration over the full fixture set", () => {
        const results = runGroupingBenchmark();
        expect(Object.keys(results)).toEqual(["proximity-only", "structural-only", "structural-plus-temporal"]);
        Object.values(results).forEach((result) => {
            expect(result.boards).toHaveLength(3);
        });
    });

    it("structural-plus-temporal reaches perfect precision and recall on the fixture set", () => {
        const results = runGroupingBenchmark();
        const { overall } = results["structural-plus-temporal"];
        expect(overall.precision).toBe(1);
        expect(overall.recall).toBe(1);
    });

    it("beats the proximity-only baseline on the simultaneous-authors board specifically", () => {
        const results = runGroupingBenchmark();
        const proximityBoard = results["proximity-only"].boards.find((b) => b.board === "simultaneous-authors");
        const temporalBoard = results["structural-plus-temporal"].boards.find((b) => b.board === "simultaneous-authors");

        // Proximity alone merges two people's overlapping strokes, which author separation prevents.
        expect(proximityBoard.overMergedPairs).toBeGreaterThan(0);
        expect(temporalBoard.overMergedPairs).toBe(0);
    });

    it("reports over-merge and under-merge as distinct counts, not one combined error rate", () => {
        const results = runGroupingBenchmark();
        const board = results["proximity-only"].boards[0];
        expect(board).toHaveProperty("overMergedPairs");
        expect(board).toHaveProperty("underMergedPairs");
    });
});
