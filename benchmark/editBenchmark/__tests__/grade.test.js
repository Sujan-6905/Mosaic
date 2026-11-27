import { describe, it, expect } from "vitest";
import { gradeResolution, gradeEditValidity, gradeGeometricRegression, gradeCase } from "../grade.js";

const rect = (overrides = {}) => ({
    type: "shape",
    shapeType: "rectangle",
    startX: 0,
    startY: 0,
    endX: 40,
    endY: 40,
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...overrides,
});

describe("gradeResolution", () => {
    const namedCase = { category: "named", expected: { elementIds: ["box-a"] } };

    it("is correctAt1 when the expected element ranks first", () => {
        const ranked = [{ elementIds: ["box-a"] }, { elementIds: ["box-b"] }];
        expect(gradeResolution(namedCase, ranked)).toMatchObject({ correctAt1: true, correctAt3: true, rank: 0 });
    });

    it("is correctAt3 but not correctAt1 when the expected element ranks second or third", () => {
        const ranked = [{ elementIds: ["box-b"] }, { elementIds: ["box-a"] }];
        expect(gradeResolution(namedCase, ranked)).toMatchObject({ correctAt1: false, correctAt3: true, rank: 1 });
    });

    it("is neither when the expected element ranks outside the top 3, or never resolves at all", () => {
        const ranked = [{ elementIds: ["x"] }, { elementIds: ["y"] }, { elementIds: ["z"] }, { elementIds: ["box-a"] }];
        expect(gradeResolution(namedCase, ranked)).toMatchObject({ correctAt1: false, correctAt3: false });
        expect(gradeResolution(namedCase, [])).toMatchObject({ correctAt1: false, correctAt3: false, rank: -1 });
    });

    it("returns null for a refusal case - there is no ground-truth target to rank", () => {
        expect(gradeResolution({ category: "refusal" }, [{ elementIds: ["box-a"] }])).toBeNull();
    });
});

describe("gradeEditValidity", () => {
    const namedCase = { category: "named", expected: { elementIds: ["box-a"] } };
    const refusalCase = { category: "refusal" };

    it("passes a named case whose diff touches exactly the expected element", () => {
        const diff = { changed: [{ elementId: "box-a" }], removed: [], added: [] };
        expect(gradeEditValidity(namedCase, { status: "planned", diff })).toEqual({ valid: true, reason: null });
    });

    it("fails a named case whose diff touches a different element than expected", () => {
        const diff = { changed: [{ elementId: "box-b" }], removed: [], added: [] };
        const result = gradeEditValidity(namedCase, { status: "planned", diff });
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("box-a");
    });

    it("fails a named case when the pipeline never produced a plan at all", () => {
        expect(gradeEditValidity(namedCase, { status: "rejected" }).valid).toBe(false);
        expect(gradeEditValidity(namedCase, { status: "invalid" }).valid).toBe(false);
        expect(gradeEditValidity(namedCase, { status: "ambiguous" }).valid).toBe(false);
    });

    it("passes a refusal case when nothing was touched", () => {
        expect(gradeEditValidity(refusalCase, { status: "invalid" })).toEqual({ valid: true, reason: null });
        expect(gradeEditValidity(refusalCase, { status: "rejected" })).toEqual({ valid: true, reason: null });
    });

    it("fails a refusal case if the pipeline actually applied a change", () => {
        const diff = { changed: [{ elementId: "box-a" }], removed: [], added: [] };
        const result = gradeEditValidity(refusalCase, { status: "planned", diff });
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("box-a");
    });
});

describe("gradeGeometricRegression", () => {
    it("does not flag a diff with no geometric side effects", () => {
        const before = { "box-a": rect({ color: "#000000" }) };
        const diff = { added: [], removed: [], changed: [{ elementId: "box-a", after: rect({ color: "#ff0000" }) }] };
        expect(gradeGeometricRegression(before, diff).regressed).toBe(false);
    });

    it("flags a move that creates a fresh overlap that wasn't there before", () => {
        const before = {
            "box-a": rect({ startX: 0, startY: 0, endX: 40, endY: 40 }),
            "box-b": rect({ startX: 200, startY: 200, endX: 240, endY: 240 }),
        };
        const diff = { added: [], removed: [], changed: [{ elementId: "box-b", after: rect({ startX: 10, startY: 10, endX: 50, endY: 50 }) }] };
        expect(gradeGeometricRegression(before, diff).regressed).toBe(true);
    });
});

describe("gradeCase", () => {
    it("composes all three measures, and skips geometric regression for a status that never applied", () => {
        const testCase = { category: "named", expected: { elementIds: ["box-a"] } };
        const result = gradeCase(testCase, { ranked: [{ elementIds: ["box-a"] }], pipelineResult: { status: "rejected" }, beforeElements: {} });

        expect(result.resolution.correctAt1).toBe(true);
        expect(result.editValidity.valid).toBe(false);
        expect(result.geometric).toBeNull();
        expect(result.pipelineStatus).toBe("rejected");
    });

    it("is fully deterministic - identical inputs grade identically on repeat calls", () => {
        const testCase = { category: "named", expected: { elementIds: ["box-a"] } };
        const before = { "box-a": rect({ color: "#000000" }) };
        const inputs = {
            ranked: [{ elementIds: ["box-a"] }],
            pipelineResult: { status: "planned", diff: { changed: [{ elementId: "box-a", after: rect({ color: "#ff0000" }) }], removed: [], added: [] } },
            beforeElements: before,
        };

        expect(gradeCase(testCase, inputs)).toEqual(gradeCase(testCase, inputs));
    });
});
