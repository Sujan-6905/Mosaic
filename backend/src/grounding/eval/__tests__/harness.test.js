import { describe, it, expect } from "vitest";
import { runResolverBenchmark } from "../harness.js";

// An accuracy floor for the resolver and a trip-wire for scoring or relation changes.
const MIN_ACCURACY_AT_1 = 0.75;

describe("reference resolver accuracy", () => {
    it("clears the accuracy floor across every fixture board combined", async () => {
        const result = await runResolverBenchmark();
        expect(result.overall.total).toBeGreaterThan(0);
        expect(result.overall.accuracyAt1).toBeGreaterThanOrEqual(MIN_ACCURACY_AT_1);
    });

    it("reports which specific cases failed, for a human to read on a regression", async () => {
        const result = await runResolverBenchmark();
        const failures = result.boards.flatMap((board) => board.cases.filter((c) => !c.correctAt1).map((c) => ({ board: board.board, ...c })));
        // Not an assertion: printed so a CI failure above names the exact
        // query that regressed instead of just a percentage.
        if (failures.length > 0) {
            console.log("resolver misses:", JSON.stringify(failures, null, 2));
        }
        expect(Array.isArray(failures)).toBe(true);
    });
});
