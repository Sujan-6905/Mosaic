import { describe, expect, it } from "vitest";
import { nextDrillStep } from "../drillSelection";

describe("nextDrillStep", () => {
    const stack = ["outer", "middle", "inner"];

    it("opens a multi-selection onto its outermost member under the pointer", () => {
        expect(nextDrillStep(stack, ["inner", "middle", "other"], "inner")).toEqual({ select: "middle" });
    });

    it("steps inward one level at a time", () => {
        expect(nextDrillStep(stack, ["outer"], "inner")).toEqual({ select: "middle" });
        expect(nextDrillStep(stack, ["middle"], "inner")).toEqual({ select: "inner" });
    });

    it("edits once nothing is left inside", () => {
        expect(nextDrillStep(stack, ["inner"], "inner")).toEqual({ edit: "inner" });
    });

    it("edits what was hit when the selection isn't under the pointer", () => {
        expect(nextDrillStep(stack, ["elsewhere"], "inner")).toEqual({ edit: "inner" });
        expect(nextDrillStep(stack, [], "inner")).toEqual({ edit: "inner" });
    });

    it("has nothing to do on empty board", () => {
        expect(nextDrillStep([], [], null)).toBeNull();
    });
});
