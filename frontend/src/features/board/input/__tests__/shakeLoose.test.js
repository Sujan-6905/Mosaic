import { describe, it, expect } from "vitest";
import { createShakeDetector } from "../shakeLoose";

const feed = (detector, xs, step = 40) => xs.map((x, n) => detector(x, n * step));

describe("createShakeDetector", () => {
    it("fires once, on the fourth quick reversal", () => {
        const results = feed(createShakeDetector(), [0, 30, 0, 30, 0, 30, 0, 30]);
        expect(results.filter(Boolean)).toHaveLength(1);
        expect(results.indexOf(true)).toBe(5);
    });

    it("ignores a steady drag and small wobbles", () => {
        expect(feed(createShakeDetector(), [0, 20, 40, 60, 80, 100]).some(Boolean)).toBe(false);
        expect(feed(createShakeDetector(), [0, 6, 0, 6, 0, 6, 0, 6, 0]).some(Boolean)).toBe(false);
    });

    it("ignores reversals spread out over a slow drag", () => {
        expect(feed(createShakeDetector(), [0, 30, 0, 30, 0, 30, 0], 400).some(Boolean)).toBe(false);
    });
});
