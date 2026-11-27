import { describe, expect, it } from "vitest";
import { recogniseSky } from "../skyGesture";

const arc = (from, to, radius = 80, steps = 60, wobble = 0) =>
    Array.from({ length: steps + 1 }, (_unused, n) => {
        const angle = from + ((to - from) * n) / steps;
        const r = radius + Math.sin(n * 1.7) * wobble;
        return { x: 200 + Math.cos(angle) * r, y: 200 + Math.sin(angle) * r };
    });

describe("reading the sky", () => {
    it("reads a closed round stroke as the sun, even drawn by an unsteady hand", () => {
        expect(recogniseSky(arc(0, Math.PI * 2, 80, 60, 6))).toBe("sun");
    });

    it("reads an open C as a crescent moon", () => {
        expect(recogniseSky(arc(Math.PI * 0.35, Math.PI * 1.65))).toBe("moon");
    });

    it("reads a closed crescent outline as the moon, not the sun", () => {
        // The outer edge of a circle, then back along a smaller circle whose centre sits to the right, meeting at both tips.
        const outer = arc(Math.PI * 0.3, Math.PI * 1.7, 90, 40);
        const tipAngle = Math.atan2(90 * Math.sin(Math.PI * 0.3), 90 * Math.cos(Math.PI * 0.3) - 60);
        const innerRadius = Math.hypot(90 * Math.cos(Math.PI * 0.3) - 60, 90 * Math.sin(Math.PI * 0.3));
        const inner = arc(Math.PI * 2 - tipAngle, tipAngle, innerRadius, 40).map((p) => ({ x: p.x + 60, y: p.y }));
        expect(recogniseSky([...outer, ...inner])).toBe("moon");
    });

    it("ignores a straight line, a scribble too small to mean anything, and a short tap", () => {
        expect(recogniseSky(Array.from({ length: 30 }, (_unused, n) => ({ x: n * 10, y: n * 4 })))).toBeNull();
        expect(recogniseSky(arc(0, Math.PI * 2, 8))).toBeNull();
        expect(recogniseSky(arc(0, 1, 80, 4))).toBeNull();
    });
});
