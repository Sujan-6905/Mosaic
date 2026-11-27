import { describe, it, expect, beforeEach } from "vitest";
import { getCompletedTours, markTourCompleted, hasCompletedAnyTour } from "../tourCompletion.js";

// jsdom here lacks a working localStorage without a backing file, so the test supplies an in-memory Storage.
const createMemoryStorage = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
    };
};

beforeEach(() => {
    Object.defineProperty(window, "localStorage", { value: createMemoryStorage(), configurable: true });
});

describe("tourCompletion", () => {
    it("returns no completed tours for a user who has never completed one", () => {
        expect(getCompletedTours("user-1")).toEqual([]);
        expect(hasCompletedAnyTour("user-1")).toBe(false);
    });

    it("records a completed track and reflects it back", () => {
        markTourCompleted("user-1", "basics");
        expect(getCompletedTours("user-1")).toEqual(["basics"]);
        expect(hasCompletedAnyTour("user-1")).toBe(true);
    });

    it("never records the same track twice", () => {
        markTourCompleted("user-1", "basics");
        markTourCompleted("user-1", "basics");
        expect(getCompletedTours("user-1")).toEqual(["basics"]);
    });

    it("accumulates multiple distinct tracks", () => {
        markTourCompleted("user-1", "basics");
        markTourCompleted("user-1", "ai");
        expect(getCompletedTours("user-1").sort()).toEqual(["ai", "basics"]);
    });

    it("keeps two different users' progress completely separate", () => {
        markTourCompleted("user-1", "basics");
        expect(getCompletedTours("user-2")).toEqual([]);
    });

    it("returns nothing without a userId", () => {
        expect(getCompletedTours(null)).toEqual([]);
    });
});
