import { describe, expect, it } from "vitest";
import { findOverlaps, mergeCounts, planMerge, resolveMerge } from "../threeWayMerge.js";

const box = (x, extra = {}) => ({ type: "shape", shapeType: "Rectangle", startX: x, startY: 0, endX: x + 100, endY: 50, color: "#000", size: 2, ...extra });

describe("three-way merge", () => {
    it("carries over a change only the other side made, and ignores server stamps", () => {
        const base = { a: box(0), b: box(200) };
        const target = { a: { ...box(0), version: 9, updatedBy: "x" }, b: box(200) };
        const source = { a: box(0), b: box(200, { color: "#f00" }) };
        const { ops, conflicts } = planMerge({ base, target, source });
        expect(conflicts).toEqual([]);
        expect(ops).toEqual([{ elementId: "b", before: target.b, after: box(200, { color: "#f00" }) }]);
    });

    it("merges different changes to the same element field by field", () => {
        const base = { a: box(0) };
        const target = { a: box(300) };
        const source = { a: box(0, { color: "#f00", text: "Hi" }) };
        const { ops, conflicts } = planMerge({ base, target, source });
        expect(conflicts).toEqual([]);
        expect(ops[0].after).toMatchObject({ startX: 300, color: "#f00", text: "Hi" });
    });

    it("treats a move as one change, never mixing half of each side's", () => {
        const base = { a: box(0) };
        const target = { a: { ...box(0), startX: 50, endX: 150 } };
        const source = { a: { ...box(0), startY: 80, endY: 130 } };
        const { conflicts } = planMerge({ base, target, source });
        expect(conflicts[0]).toMatchObject({ kind: "both-changed", parts: ["position"] });
    });

    it("asks when both sides changed the same thing differently, and keeps the other side's clean changes either way", () => {
        const base = { a: box(0) };
        const target = { a: box(0, { color: "#00f", text: "Ours" }) };
        const source = { a: box(0, { color: "#f00", size: 4 }) };
        const plan = planMerge({ base, target, source });
        expect(plan.conflicts[0].parts).toEqual(["color"]);
        expect(resolveMerge(plan, {}, target)[0].after).toMatchObject({ color: "#00f", size: 4, text: "Ours" });
        expect(resolveMerge(plan, { a: "take" }, target)[0].after).toMatchObject({ color: "#f00", size: 4, text: "Ours" });
    });

    it("adds, removes, and asks when one side removed what the other edited", () => {
        const base = { kept: box(0), gone: box(200), edited: box(400) };
        const target = { kept: box(0), gone: box(200), edited: box(400, { text: "changed here" }) };
        const source = { kept: box(0), added: box(600) };
        const plan = planMerge({ base, target, source });
        expect(mergeCounts(plan.ops)).toEqual({ added: 1, changed: 0, removed: 1 });
        expect(plan.conflicts).toEqual([expect.objectContaining({ elementId: "edited", kind: "removed-there" })]);
        expect(resolveMerge(plan, { edited: "take" }, target).find((op) => op.elementId === "edited").after).toBeNull();
    });

    it("lets go of an arrow's end when the merge removes what it was attached to", () => {
        const arrow = {
            type: "connector",
            startX: 0,
            startY: 0,
            endX: 1,
            endY: 1,
            startElementId: "gone",
            endElementId: "kept",
            startAnchor: { x: 1, y: 0.5 },
        };
        const base = { gone: box(0), kept: box(200), arrow };
        const target = { ...base };
        const source = { kept: box(200), arrow };
        const ops = resolveMerge(planMerge({ base, target, source }), {}, target);
        expect(ops.find((op) => op.elementId === "arrow").after).toMatchObject({ startElementId: null, startAnchor: null, endElementId: "kept" });
    });

    it("compares values regardless of key order", () => {
        const base = { a: { type: "text", x: 0, y: 0, text: "a" } };
        const target = { a: { text: "a", y: 0, x: 0, type: "text" } };
        const source = { a: { type: "text", x: 0, y: 0, text: "b" } };
        expect(planMerge({ base, target, source }).ops).toHaveLength(1);
    });

    it("points out where the two sides' new shapes now overlap", () => {
        const base = {};
        const target = { mine: box(0) };
        const source = { theirs: box(40) };
        expect(findOverlaps({ base, target, source })).toEqual([expect.objectContaining({ sourceId: "theirs", targetId: "mine" })]);
    });
});
