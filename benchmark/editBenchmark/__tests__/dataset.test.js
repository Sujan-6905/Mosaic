import { describe, it, expect } from "vitest";
import { EDIT_BENCHMARK_CASES } from "../dataset.js";
import { BOARDS_BY_NAME } from "../boards.js";

const REQUIRED_CATEGORIES = ["named", "spatial", "freehand", "group", "multistep", "refusal"];

describe("EDIT_BENCHMARK_CASES", () => {
    it("has at least fifty instruction/board pairs", () => {
        expect(EDIT_BENCHMARK_CASES.length).toBeGreaterThanOrEqual(50);
    });

    it("has every required category represented", () => {
        const present = new Set(EDIT_BENCHMARK_CASES.map((testCase) => testCase.category));
        REQUIRED_CATEGORIES.forEach((category) => expect(present.has(category)).toBe(true));
    });

    it("includes refusal cases, each with no expected elementIds to touch", () => {
        const refusals = EDIT_BENCHMARK_CASES.filter((testCase) => testCase.category === "refusal");
        expect(refusals.length).toBeGreaterThan(0);
        refusals.forEach((testCase) => expect(testCase.expected).toBeUndefined());
    });

    it("has unique case ids", () => {
        const ids = EDIT_BENCHMARK_CASES.map((testCase) => testCase.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("every case references a board that actually exists", () => {
        EDIT_BENCHMARK_CASES.forEach((testCase) => {
            expect(BOARDS_BY_NAME[testCase.board], `${testCase.id} references unknown board "${testCase.board}"`).toBeDefined();
        });
    });

    it("every non-refusal case's expected elementIds exist on its own board", () => {
        EDIT_BENCHMARK_CASES.filter((testCase) => testCase.category !== "refusal").forEach((testCase) => {
            const board = BOARDS_BY_NAME[testCase.board];
            testCase.expected.elementIds.forEach((elementId) => {
                expect(board.elements[elementId], `${testCase.id} expects unknown element "${elementId}" on board "${testCase.board}"`).toBeDefined();
            });
        });
    });

    it("every non-refusal case has a non-empty targetPhrase for resolution scoring", () => {
        EDIT_BENCHMARK_CASES.filter((testCase) => testCase.category !== "refusal").forEach((testCase) => {
            expect(typeof testCase.targetPhrase, testCase.id).toBe("string");
            expect(testCase.targetPhrase.length, testCase.id).toBeGreaterThan(0);
        });
    });
});
