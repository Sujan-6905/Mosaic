import { describe, it, expect } from "vitest";
import { classifyChange, diffElements } from "../elementChanges.js";

describe("classifyChange", () => {
    it("calls a change of position alone a move, whatever the server stamped on it", () => {
        const before = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, color: "red", version: 3, updatedBy: "a" };
        const after = { ...before, startX: 20, endX: 30, version: 4, updatedBy: "b" };
        expect(classifyChange(before, after)).toBe("moved");
        expect(classifyChange(before, { ...after, color: "blue" })).toBe("modified");
    });
});

describe("diffElements", () => {
    it("sorts changes into added, removed, moved and modified, skipping elements only the server restamped", () => {
        const box = { type: "shape", startX: 0, startY: 0, endX: 10, endY: 10, color: "red", version: 1 };
        const before = { kept: box, moved: box, recoloured: box, gone: box };
        const after = { kept: { ...box, version: 2 }, moved: { ...box, startX: 5 }, recoloured: { ...box, color: "blue" }, fresh: box };
        const diff = diffElements(before, after);
        expect(diff.added.map((entry) => entry.elementId)).toEqual(["fresh"]);
        expect(diff.removed.map((entry) => entry.elementId)).toEqual(["gone"]);
        expect(diff.moved.map((entry) => entry.elementId)).toEqual(["moved"]);
        expect(diff.modified.map((entry) => entry.elementId)).toEqual(["recoloured"]);
    });
});
