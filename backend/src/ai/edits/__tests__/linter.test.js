import { describe, it, expect } from "vitest";
import { describeLintForPeople, lintScene } from "../linter.js";

const shape = (overrides = {}) => ({
    type: "shape",
    shapeType: "rectangle",
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    startX: 0,
    startY: 0,
    endX: 50,
    endY: 50,
    ...overrides,
});

const frame = (overrides = {}) => ({
    type: "frame",
    name: "Zone",
    color: "#000000",
    zIndex: 0,
    rotation: 0,
    startX: 0,
    startY: 0,
    endX: 200,
    endY: 200,
    ...overrides,
});

const connector = (overrides = {}) => ({
    type: "connector",
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 100,
    startElementId: "a",
    endElementId: "b",
    color: "#000000",
    size: 2,
    opacity: 100,
    arrowStart: false,
    arrowEnd: true,
    zIndex: 2,
    rotation: 0,
    ...overrides,
});

const sticky = (overrides = {}) => ({
    type: "sticky",
    x: 0,
    y: 0,
    width: 150,
    height: 90,
    text: "note",
    color: "#000000",
    fillColor: "#fef08a",
    size: 14,
    zIndex: 1,
    rotation: 0,
    ...overrides,
});

const rulesOf = (lints) => lints.map((lint) => lint.rule);

describe("lintScene", () => {
    it("flags a new overlap that wasn't there before, and not one that already existed", () => {
        const previousElements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 100, endX: 150 }) };
        const overlapping = { a: previousElements.a, b: shape({ startX: 20, endX: 70 }) };
        expect(rulesOf(lintScene(overlapping, { previousElements }))).toContain("overlap-regression");
        expect(rulesOf(lintScene(previousElements, { previousElements }))).not.toContain("overlap-regression");
    });

    it("flags an element that claims frame membership but sits outside the frame's bounds", () => {
        const outside = { zone: frame(), child: shape({ frameId: "zone", startX: 900, startY: 900, endX: 950, endY: 950 }) };
        const inside = { zone: frame(), child: shape({ frameId: "zone", startX: 10, startY: 10, endX: 50, endY: 50 }) };
        expect(rulesOf(lintScene(outside))).toContain("outside-frame");
        expect(rulesOf(lintScene(inside))).not.toContain("outside-frame");
    });

    it("flags a connector bound to a deleted element", () => {
        const dangling = { a: shape(), c: connector({ startElementId: "a", endElementId: "b" }) };
        const bound = { a: shape(), b: shape({ startX: 200, endX: 250 }), c: connector() };
        expect(rulesOf(lintScene(dangling))).toContain("dangling-connector");
        expect(rulesOf(lintScene(bound))).not.toContain("dangling-connector");
    });

    it("flags a sticky with text contrast below the WCAG AA floor", () => {
        const lowContrast = { note: sticky({ color: "#fefce8", fillColor: "#fef9c3" }) };
        const goodContrast = { note: sticky({ color: "#000000", fillColor: "#fef08a" }) };
        expect(rulesOf(lintScene(lowContrast))).toContain("low-contrast");
        expect(rulesOf(lintScene(goodContrast))).not.toContain("low-contrast");
    });

    it("flags an element positioned absurdly far from the rest of the board", () => {
        const offCanvas = { a: shape(), b: shape({ startX: 500_000, endX: 500_050 }) };
        const onCanvas = { a: shape(), b: shape({ startX: 300, endX: 350 }) };
        expect(rulesOf(lintScene(offCanvas))).toContain("off-canvas");
        expect(rulesOf(lintScene(onCanvas))).not.toContain("off-canvas");
    });

    it("flags a pair that was aligned before this edit and no longer is", () => {
        const previousElements = { a: shape({ startY: 0, endY: 50 }), b: shape({ startX: 200, startY: 0, endX: 250, endY: 50 }) };
        const misaligned = { a: previousElements.a, b: shape({ startX: 200, startY: 900, endX: 250, endY: 950 }) };
        expect(rulesOf(lintScene(misaligned, { previousElements }))).toContain("alignment-regression");
        expect(rulesOf(lintScene(previousElements, { previousElements }))).not.toContain("alignment-regression");
    });

    it("flags a sticky whose text no longer fits its own box", () => {
        const overflowing = { note: sticky({ height: 20, text: "a very long note that will not fit into twenty pixels of height at all" }) };
        const fitting = { note: sticky({ height: 90, text: "short" }) };
        expect(rulesOf(lintScene(overflowing))).toContain("text-overflow");
        expect(rulesOf(lintScene(fitting))).not.toContain("text-overflow");
    });

    it("distinguishes pre-existing problems from ones this edit introduced", () => {
        const alreadyDangling = { c: connector({ startElementId: "gone", endElementId: "also-gone" }) };
        const baseline = lintScene(alreadyDangling);
        const afterUnrelatedEdit = lintScene(alreadyDangling, { previousElements: alreadyDangling });
        expect(baseline.some((lint) => lint.rule === "dangling-connector")).toBe(true);
        expect(afterUnrelatedEdit.some((lint) => lint.rule === "dangling-connector")).toBe(true);
        // Neither overlap-regression nor alignment-regression fire when
        // nothing actually changed between previousElements and elements.
        expect(afterUnrelatedEdit.some((lint) => lint.rule === "overlap-regression")).toBe(false);
    });
});

describe("describeLintForPeople", () => {
    it("names objects by their words, or by what they are when they have none", () => {
        const elements = { a: { type: "sticky", text: "Launch checklist\nsecond line" }, b: { type: "shape" } };
        expect(describeLintForPeople({ rule: "overlap-regression", elementIds: ["a", "b"] }, elements)).toBe('"Launch checklist" and a shape now overlap');
    });

    it("shortens long text and falls back to the message for unknown rules", () => {
        const elements = { a: { type: "text", text: "A very long label that keeps going and going" } };
        expect(describeLintForPeople({ rule: "low-contrast", elementIds: ["a"] }, elements)).toBe(
            'the text on "A very long label that…" is hard to read on its new colour',
        );
        expect(describeLintForPeople({ rule: "something-new", elementIds: ["a"], message: "raw" }, elements)).toBe("raw");
    });
});
