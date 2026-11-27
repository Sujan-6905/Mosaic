import { describe, it, expect } from "vitest";
import { findNextVisibleStepIndex, findPreviousVisibleStepIndex, placeCallout } from "../tourNavigation.js";

const steps = [{ target: "a" }, { target: "b" }, { target: "c" }, { target: "d" }];
const existsOnly =
    (...present) =>
    (step) =>
        present.includes(step.target);

describe("findNextVisibleStepIndex", () => {
    it("returns the starting index when its own target exists", () => {
        expect(findNextVisibleStepIndex(steps, 0, existsOnly("a", "b", "c", "d"))).toBe(0);
    });

    it("skips a missing anchor and lands on the next real one", () => {
        expect(findNextVisibleStepIndex(steps, 1, existsOnly("a", "c", "d"))).toBe(2);
    });

    it("returns -1 when nothing from fromIndex onward exists", () => {
        expect(findNextVisibleStepIndex(steps, 2, existsOnly("a", "b"))).toBe(-1);
    });

    it("returns -1 for an empty step list", () => {
        expect(findNextVisibleStepIndex([], 0, () => true)).toBe(-1);
    });
});

describe("findPreviousVisibleStepIndex", () => {
    it("returns the starting index when its own target exists", () => {
        expect(findPreviousVisibleStepIndex(steps, 3, existsOnly("a", "b", "c", "d"))).toBe(3);
    });

    it("skips a missing anchor going backward", () => {
        expect(findPreviousVisibleStepIndex(steps, 2, existsOnly("a", "d"))).toBe(0);
    });

    it("returns -1 when nothing at or before fromIndex exists", () => {
        expect(findPreviousVisibleStepIndex(steps, 1, existsOnly("c", "d"))).toBe(-1);
    });
});

describe("placeCallout", () => {
    const viewport = { width: 1000, height: 700 };
    const callout = { width: 300, height: 200 };
    const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

    it("sits below a target with room underneath", () => {
        expect(placeCallout(box(100, 100, 100, 40), callout, viewport)).toEqual({ left: 16, top: 156 });
    });

    it("sits above a target at the bottom of the screen", () => {
        expect(placeCallout(box(400, 620, 200, 60), callout, viewport).top).toBe(404);
    });

    it("sits beside a tall panel instead of over it", () => {
        const placed = placeCallout(box(640, 60, 340, 580), callout, viewport);
        expect(placed.left).toBe(324);
    });

    it("stays on screen when nothing fits", () => {
        const placed = placeCallout(box(0, 0, 1000, 700), callout, viewport);
        expect(placed).toEqual({ left: 684, top: 484 });
    });
});
