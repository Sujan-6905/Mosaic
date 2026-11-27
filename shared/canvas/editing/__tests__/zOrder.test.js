import { describe, it, expect } from "vitest";
import { bringToFront, sendToBack, bringForward, sendBackward } from "../zOrder.js";

const el = (zIndex) => ({ type: "shape", startX: 0, startY: 0, endX: 1, endY: 1, zIndex });

describe("bringToFront", () => {
    it("stacks the moved ids above the current max, preserving their relative order", () => {
        const elements = { a: el(1), b: el(2), c: el(3) };
        const updates = bringToFront(elements, ["a", "b"]);
        expect(updates.a).toBeLessThan(updates.b);
        expect(updates.a).toBeGreaterThan(3);
        expect(updates.c).toBeUndefined();
    });
});

describe("sendToBack", () => {
    it("stacks the moved ids below the current min, preserving their relative order", () => {
        const elements = { a: el(1), b: el(2), c: el(3) };
        const updates = sendToBack(elements, ["b", "c"]);
        expect(updates.b).toBeLessThan(updates.c);
        expect(updates.c).toBeLessThan(1);
        expect(updates.a).toBeUndefined();
    });
});

describe("bringForward", () => {
    it("hops a single element past the next element above it without touching anyone else", () => {
        const elements = { a: el(1), b: el(2), c: el(3) };
        const updates = bringForward(elements, ["a"]);
        expect(Object.keys(updates)).toEqual(["a"]);
        expect(updates.a).toBeGreaterThan(2);
        expect(updates.a).toBeLessThan(3);
    });

    it("no-ops an element that is already at the top", () => {
        const elements = { a: el(1), b: el(2) };
        expect(bringForward(elements, ["b"])).toEqual({});
    });

    it("carries a contiguous block past its blocker together, preserving internal order", () => {
        const elements = { a: el(1), b: el(2), c: el(3), d: el(4) };
        const updates = bringForward(elements, ["b", "c"]);
        expect(updates.b).toBeLessThan(updates.c);
        expect(updates.b).toBeGreaterThan(4); // both now above D's untouched zIndex of 4
        expect(updates.d).toBeUndefined();
    });

    it("moves non-adjacent selected elements independently past their own neighbor", () => {
        const elements = { a: el(1), b: el(2), c: el(3), d: el(4), e: el(5) };
        const updates = bringForward(elements, ["b", "d"]);
        expect(updates.b).toBeGreaterThan(3); // hopped past c (still below d's untouched 4)
        expect(updates.b).toBeLessThan(4);
        expect(updates.d).toBeGreaterThan(5); // hopped past e
    });
});

describe("sendBackward", () => {
    it("hops a single element past the next element below it without touching anyone else", () => {
        const elements = { a: el(1), b: el(2), c: el(3) };
        const updates = sendBackward(elements, ["c"]);
        expect(Object.keys(updates)).toEqual(["c"]);
        expect(updates.c).toBeGreaterThan(1);
        expect(updates.c).toBeLessThan(2);
    });

    it("no-ops an element that is already at the bottom", () => {
        const elements = { a: el(1), b: el(2) };
        expect(sendBackward(elements, ["a"])).toEqual({});
    });

    it("carries a contiguous block below its blocker together, preserving internal order", () => {
        const elements = { a: el(1), b: el(2), c: el(3), d: el(4) };
        const updates = sendBackward(elements, ["b", "c"]);
        expect(updates.b).toBeLessThan(updates.c);
        expect(updates.c).toBeLessThan(1); // both now below A's untouched zIndex of 1
        expect(updates.a).toBeUndefined();
    });
});
