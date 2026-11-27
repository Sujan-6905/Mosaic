import { describe, it, expect } from "vitest";
import { autoRepair, describeRemainingLints } from "../repair.js";

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

describe("autoRepair", () => {
    it("keeps text readable when an edit fills its shape with a dark colour", () => {
        const before = shape({ text: "Login", fillColor: "#ffffff" });
        const { elements: repaired, applied } = autoRepair({ box: { ...before, fillColor: "#1d4ed8" } }, { box: before });
        expect(applied.some((r) => r.rule === "low-contrast")).toBe(true);
        expect(repaired.box.textColor).toBe("#ffffff");
    });

    it("leaves a low-contrast pairing alone when this edit didn't choose it", () => {
        const chosen = shape({ text: "Faint on purpose", fillColor: "#1d4ed8" });
        const { elements: repaired, remainingLints } = autoRepair({ box: chosen }, { box: chosen });
        expect(repaired.box.textColor).toBeUndefined();
        expect(remainingLints.some((lint) => lint.rule === "low-contrast")).toBe(true);
    });

    it("nudges a newly introduced small overlap apart without a model call", () => {
        const previousElements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 200, endX: 250 }) };
        const elements = { a: previousElements.a, b: shape({ startX: 40, endX: 90 }) };
        const { elements: repaired, applied } = autoRepair(elements, previousElements);
        expect(applied.some((r) => r.rule === "overlap-regression")).toBe(true);
        expect(repaired.a.endX <= repaired.b.startX || repaired.b.endX <= repaired.a.startX).toBe(true);
    });

    it("clears an overlap regression introduced by this edit", () => {
        const previousElements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 100, endX: 150 }) };
        const elements = { a: previousElements.a, b: shape({ startX: 20, endX: 70 }) };
        const { applied, remainingLints } = autoRepair(elements, previousElements);
        expect(applied.some((r) => r.rule === "overlap-regression")).toBe(true);
        expect(remainingLints.some((lint) => lint.rule === "overlap-regression")).toBe(false);
    });

    it("clears a stale frame membership claim that no longer matches geometry", () => {
        const zone = { type: "frame", name: "Zone", color: "#000", zIndex: 0, rotation: 0, startX: 0, startY: 0, endX: 200, endY: 200 };
        const elements = { zone, child: shape({ frameId: "zone", startX: 900, startY: 900, endX: 950, endY: 950 }) };
        const { elements: repaired, applied } = autoRepair(elements, elements);
        expect(applied.some((r) => r.rule === "outside-frame")).toBe(true);
        expect(repaired.child.frameId).toBeNull();
    });

    it("unbinds a connector's dangling endpoint", () => {
        const elements = {
            a: shape(),
            c: {
                type: "connector",
                startX: 25,
                startY: 25,
                endX: 500,
                endY: 500,
                startElementId: "a",
                endElementId: "deleted-element",
                color: "#000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 2,
                rotation: 0,
            },
        };
        const { elements: repaired, applied } = autoRepair(elements, elements);
        expect(applied.some((r) => r.rule === "dangling-connector")).toBe(true);
        expect(repaired.c.endElementId).toBeNull();
        expect(repaired.c.startElementId).toBe("a");
    });

    it("reports every auto-repair applied, never silently", () => {
        const previousElements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 100, endX: 150 }) };
        const elements = { a: previousElements.a, b: shape({ startX: 20, endX: 70 }) };
        const { applied } = autoRepair(elements, previousElements);
        expect(applied.length).toBeGreaterThan(0);
    });

    it("leaves an ambiguous lint (no unambiguous fix) in remainingLints", () => {
        const elements = { a: shape(), b: shape({ startX: 500_000, endX: 500_050 }) };
        const { remainingLints } = autoRepair(elements, elements);
        expect(remainingLints.some((lint) => lint.rule === "off-canvas")).toBe(true);
    });

    it("bounds the retry count", () => {
        const previousElements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 100, endX: 150 }) };
        const elements = { a: previousElements.a, b: shape({ startX: 20, endX: 70 }) };
        const zeroPasses = autoRepair(elements, previousElements, { maxPasses: 0 });
        expect(zeroPasses.applied).toEqual([]);
        expect(zeroPasses.remainingLints.some((lint) => lint.rule === "overlap-regression")).toBe(true);
    });
});

describe("describeRemainingLints", () => {
    it("produces a specific, non-empty complaint for a re-prompt", () => {
        const elements = { a: shape(), b: shape({ startX: 500_000, endX: 500_050 }) };
        const { remainingLints } = autoRepair(elements, elements);
        const message = describeRemainingLints(remainingLints);
        expect(message).toContain("off-canvas");
    });
});
