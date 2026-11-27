// Deterministic grading of a case's ground truth against what the pipeline produced.
import { lintScene, hasGeometricRegression } from "../../backend/src/ai/edits/linter.js";

const changedElementIds = (diff) => {
    const ids = new Set();
    diff.changed.forEach((entry) => ids.add(entry.elementId));
    diff.removed.forEach((entry) => ids.add(entry.elementId));
    return ids;
};

// `ranked` is the resolver's output for the case's targetPhrase; refusal cases have no
// target to rank, so they report null.
export const gradeResolution = (testCase, ranked) => {
    if (testCase.category === "refusal") return null;
    const expectedIds = new Set(testCase.expected.elementIds);
    const rank = ranked.findIndex((candidate) => candidate.elementIds.some((id) => expectedIds.has(id)));
    return { correctAt1: rank === 0, correctAt3: rank >= 0 && rank < 3, rank };
};

// Only "planned" changed anything. "skipped" (no API key) and "error" (the model call failed)
// are unscored, so a rate-limited run can't inflate its refusal score.
export const gradeEditValidity = (testCase, pipelineResult) => {
    if (pipelineResult.status === "skipped" || pipelineResult.status === "error") return null;
    const touched = pipelineResult.status === "planned" ? changedElementIds(pipelineResult.diff) : new Set();

    if (testCase.category === "refusal") {
        const valid = touched.size === 0;
        return { valid, reason: valid ? null : `applied an edit touching: ${[...touched].join(", ")}` };
    }

    const missing = testCase.expected.elementIds.filter((id) => !touched.has(id));
    return {
        valid: missing.length === 0,
        reason: missing.length === 0 ? null : `expected element(s) not touched: ${missing.join(", ")} (pipeline status: ${pipelineResult.status})`,
    };
};

// Rebuilds the "after" elements from the diff and reuses the linter's before/after comparison.
export const gradeGeometricRegression = (beforeElements, diff) => {
    const afterElements = { ...beforeElements };
    diff.added.forEach((entry) => {
        afterElements[entry.elementId] = entry.element;
    });
    diff.changed.forEach((entry) => {
        afterElements[entry.elementId] = entry.after;
    });
    diff.removed.forEach((entry) => {
        delete afterElements[entry.elementId];
    });

    const lints = lintScene(afterElements, { previousElements: beforeElements });
    return { regressed: hasGeometricRegression(lints), lints: lints.filter((lint) => lint.rule.endsWith("-regression")) };
};

// Geometric regression is null unless an edit actually reached "planned".
export const gradeCase = (testCase, { ranked, pipelineResult, beforeElements }) => {
    const resolution = gradeResolution(testCase, ranked);
    const editValidity = gradeEditValidity(testCase, pipelineResult);
    const geometric = pipelineResult.status === "planned" ? gradeGeometricRegression(beforeElements, pipelineResult.diff) : null;

    return { id: testCase.id, category: testCase.category, resolution, editValidity, geometric, pipelineStatus: pipelineResult.status };
};
