import { describe, it, expect } from "vitest";
import { summarizeResults, formatSummaryTable } from "../metrics.js";

const result = (overrides) => ({
    id: "case-1",
    category: "named",
    resolution: { correctAt1: true, correctAt3: true },
    editValidity: { valid: true, reason: null },
    geometric: { regressed: false },
    pipelineStatus: "planned",
    modelCalls: 1,
    latencyMs: 100,
    ...overrides,
});

describe("summarizeResults", () => {
    it("computes overall rates across a mix of pass/fail results", () => {
        const results = [result({ id: "a" }), result({ id: "b", resolution: { correctAt1: false, correctAt3: true }, editValidity: { valid: false } })];

        const summary = summarizeResults(results);
        expect(summary.overall.total).toBe(2);
        expect(summary.overall.resolutionAccuracyAt1).toBe(0.5);
        expect(summary.overall.resolutionAccuracyAt3).toBe(1);
        expect(summary.overall.editValidityRate).toBe(0.5);
    });

    it("breaks results out per category independently of the overall numbers", () => {
        const results = [result({ id: "a", category: "named" }), result({ id: "b", category: "spatial", editValidity: { valid: false } })];

        const summary = summarizeResults(results);
        expect(summary.byCategory.named.editValidityRate).toBe(1);
        expect(summary.byCategory.spatial.editValidityRate).toBe(0);
    });

    it("reports null rather than a misleading 0 when a measure has nothing scored", () => {
        const summary = summarizeResults([result({ resolution: null, geometric: null })]);
        expect(summary.overall.resolutionAccuracyAt1).toBeNull();
        expect(summary.overall.geometricRegressionRate).toBeNull();
    });

    it("counts an ambiguous pipeline status toward the ask rate", () => {
        const results = [result({ pipelineStatus: "ambiguous" }), result({ pipelineStatus: "planned" })];
        expect(summarizeResults(results).overall.askRate).toBe(0.5);
    });

    it("treats a null editValidity (no model call made) as unscored, not a failure", () => {
        const summary = summarizeResults([result({ editValidity: null })]);
        expect(summary.overall.editValidityRate).toBeNull();
    });

    it("is deterministic - identical input summarizes identically on repeat calls", () => {
        const results = [result({ id: "a" }), result({ id: "b", category: "spatial" })];
        expect(summarizeResults(results)).toEqual(summarizeResults(results));
    });
});

describe("formatSummaryTable", () => {
    it("renders an overall row and one row per category, aligned into columns", () => {
        const summary = summarizeResults([result({ category: "named" }), result({ category: "spatial" })]);
        const table = formatSummaryTable(summary);

        expect(table).toContain("overall");
        expect(table).toContain("named");
        expect(table).toContain("spatial");
        const lines = table.split("\n");
        expect(new Set(lines.map((line) => line.length)).size).toBe(1); // every row padded to equal width
    });
});
