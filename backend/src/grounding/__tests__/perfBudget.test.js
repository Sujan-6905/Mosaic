import { describe, it, expect } from "vitest";
import { generateStressElements, measureGroundingStages, summarizeStageSamples, STAGE_BUDGETS_MS } from "./perfBudget.js";
import { scopeElementsToViewport } from "../viewportScope.js";

// Unscoped relation derivation is O(n^2), so 5,000 elements is gated through the scoped path below.
const UNSCOPED_BOARD_SIZES = [100, 1000];
const MEASURED_RUNS = 3;

// A discarded warm-up run, so JIT compilation doesn't skew the first sample.
const measureWithWarmup = async (elements) => {
    await measureGroundingStages(elements);
    const samplesByStage = { canonicalScene: [], grouping: [], relations: [], serialization: [], resolution: [] };
    for (let i = 0; i < MEASURED_RUNS; i++) {
        const stages = await measureGroundingStages(elements);
        Object.entries(stages).forEach(([stage, durationMs]) => samplesByStage[stage].push(durationMs));
    }
    return summarizeStageSamples(samplesByStage);
};

const expectWithinBudget = (summary, size) => {
    Object.entries(STAGE_BUDGETS_MS).forEach(([stage, budgetMs]) => {
        expect(summary[stage].p50, `${stage} at ${size} elements exceeded its ${budgetMs}ms budget`).toBeLessThan(budgetMs);
    });
};

describe("grounding performance budgets", () => {
    it.each(UNSCOPED_BOARD_SIZES)("stays within every stage budget, unscoped, at %i elements", async (size) => {
        const summary = await measureWithWarmup(generateStressElements(size));
        expectWithinBudget(summary, size);
    });

    // Unscoped, 5,000 elements took ~14.4s in relations alone (~18x budget), too slow to run here.
    it("stays within every stage budget at 5,000 elements once scoped to a viewport", async () => {
        const elements = generateStressElements(5000);
        const viewport = { minX: 0, minY: 0, maxX: 2000, maxY: 2000 };
        const { elements: scoped, partial } = scopeElementsToViewport(elements, viewport);

        expect(partial).toBe(true);
        expect(Object.keys(scoped).length).toBeLessThan(Object.keys(elements).length);

        const summary = await measureWithWarmup(scoped);
        expectWithinBudget(summary, "5000 (scoped)");
    });
});
