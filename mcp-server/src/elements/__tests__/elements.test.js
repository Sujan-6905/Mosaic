import { describe, it, expect } from "vitest";
import { applyPatch, buildElement } from "../elementDefaults.js";
import { buildElementRefs, summarizeElement } from "../elementSummary.js";

const box = (overrides = {}) => buildElement("shape", { shapeType: "rectangle", startX: 0, startY: 0, endX: 120, endY: 80, ...overrides });

describe("buildElement", () => {
    it("fills drawing defaults and maps a tool shape name onto the canvas's own", () => {
        const element = box();
        expect(element).toMatchObject({ type: "shape", shapeType: "Rectangle", color: "#000000", rotation: 0, locked: false });
    });

    it("refuses an unknown type and names the ones it accepts", () => {
        expect(() => buildElement("hologram", {})).toThrow(/Unknown element type "hologram"\. Expected one of: .*shape/);
    });

    it("refuses an element the board's schema would drop, saying which field is wrong", () => {
        expect(() => box({ startX: "left" })).toThrow(/Invalid shape element: startX/);
    });
});

describe("applyPatch", () => {
    it("keeps every field the patch leaves out", () => {
        const patched = applyPatch(box(), { color: "#ff0000" });
        expect(patched).toMatchObject({ color: "#ff0000", shapeType: "Rectangle", endX: 120 });
    });

    it("refuses a patch that would leave the element invalid", () => {
        expect(() => applyPatch(box(), { endY: "tall" })).toThrow(/Invalid update: endY/);
    });
});

describe("summarizeElement", () => {
    it("adds a normalised box and the same ref describe_board uses", () => {
        const element = box({ startX: 120, endX: 0 });
        const scene = buildElementRefs(new Map([["el-1", element]]));
        const summary = summarizeElement("el-1", element, scene);
        expect(summary.bounds).toEqual({ minX: 0, minY: 0, maxX: 120, maxY: 80 });
        expect(summary.ref).toMatch(/^obj_/);
        expect(summary.id).toBe("el-1");
    });
});
