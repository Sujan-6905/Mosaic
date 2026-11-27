import { describe, it, expect, vi } from "vitest";

vi.mock("../operationLog.js", () => ({ flushOperationLog: vi.fn(), reconstructStateAtSeq: vi.fn() }));
vi.mock("ottoman", () => ({ getDefaultInstance: vi.fn() }));

const { sampleReelFrames } = await import("../boardReel.js");

const base = { seq: 4, elements: { a: { type: "rectangle", x: 0, y: 0 } }, background: { type: "blank", colorToken: null } };
const add = (seq, id) => ({ seq, opType: "add", elementId: id, after: { type: "rectangle", x: seq, y: 0 } });

describe("sampleReelFrames", () => {
    it("starts at the base and ends on the latest change, evenly spaced between", () => {
        const ops = Array.from({ length: 10 }, (_, n) => add(5 + n, `e${n}`));
        const frames = sampleReelFrames(base, ops, 6);

        expect(frames.map((frame) => frame.seq)).toEqual([4, 6, 8, 10, 12, 14]);
        expect(Object.keys(frames.at(-1).elements)).toHaveLength(11);
        expect(Object.keys(frames[0].elements)).toEqual(["a"]);
    });

    it("gives one frame per change when there are fewer changes than frames", () => {
        const frames = sampleReelFrames(base, [add(5, "b"), { seq: 6, opType: "delete", elementId: "a" }], 24);

        expect(frames.map((frame) => Object.keys(frame.elements))).toEqual([["a"], ["a", "b"], ["b"]]);
    });

    it("never changes the base it was given", () => {
        sampleReelFrames(base, [{ seq: 5, opType: "delete", elementId: "a" }], 4);
        expect(base.elements.a).toBeDefined();
    });
});
