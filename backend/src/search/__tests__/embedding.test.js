import { describe, it, expect } from "vitest";
import { tokenize, embedText, cosineSimilarity, VECTOR_DIM } from "../embedding.js";

describe("tokenize", () => {
    it("lowercases and splits on non-alphanumeric characters", () => {
        expect(tokenize("User Login-Flow, v2!")).toEqual(["user", "login", "flow", "v2"]);
    });

    it("returns an empty array for empty or missing text", () => {
        expect(tokenize("")).toEqual([]);
        expect(tokenize(undefined)).toEqual([]);
    });
});

describe("embedText", () => {
    it("returns a vector of the fixed dimension", () => {
        expect(embedText("auth flow")).toHaveLength(VECTOR_DIM);
    });

    it("returns an all-zero vector for empty text", () => {
        expect(embedText("").every((value) => value === 0)).toBe(true);
    });

    it("is unit-normalized for non-empty text", () => {
        const vector = embedText("user login flow with OAuth and SSO");
        const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        expect(magnitude).toBeCloseTo(1, 5);
    });

    it("is order-independent (bag of words)", () => {
        expect(embedText("auth flow diagram")).toEqual(embedText("diagram flow auth"));
    });

    it("is deterministic for the same input", () => {
        expect(embedText("sprint retro notes")).toEqual(embedText("sprint retro notes"));
    });
});

describe("cosineSimilarity", () => {
    it("is 1 for identical text", () => {
        const a = embedText("user login flow with OAuth");
        expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
    });

    it("is higher for text sharing more words than for unrelated text", () => {
        const query = embedText("login flow");
        const related = embedText("user login flow with OAuth");
        const unrelated = embedText("quarterly budget spreadsheet");
        expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
    });

    it("is 0 for two empty-text vectors", () => {
        expect(cosineSimilarity(embedText(""), embedText(""))).toBe(0);
    });
});
