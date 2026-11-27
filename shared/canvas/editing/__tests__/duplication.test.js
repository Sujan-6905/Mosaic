import { describe, it, expect } from "vitest";
import { buildDuplicatedElements } from "../duplication.js";

const shape = (startX, startY, endX, endY, extra = {}) => ({
    type: "shape",
    startX,
    startY,
    endX,
    endY,
    zIndex: 0,
    groupId: null,
    locked: false,
    ...extra,
});

const makeIdGenerator = (prefix) => {
    let n = 0;
    return () => `${prefix}${n++}`;
};

describe("buildDuplicatedElements", () => {
    it("offsets geometry and assigns fresh unique ids", () => {
        const elements = { a: shape(0, 0, 10, 10, { zIndex: 1 }) };
        const result = buildDuplicatedElements(elements, ["a"], { dx: 5, dy: 5 }, makeIdGenerator("id"), 10);
        expect(result).toHaveLength(1);
        expect(result[0].elementId).not.toBe("a");
        expect(result[0].element).toMatchObject({ startX: 5, startY: 5, endX: 15, endY: 15 });
    });

    it("assigns zIndex above the given base, preserving the sources' relative order", () => {
        // a has the higher source zIndex (5) but is listed first in `ids` -
        // the sort by source zIndex should still put b's copy below a's.
        const elements = { a: shape(50, 0, 51, 1, { zIndex: 5 }), b: shape(20, 0, 21, 1, { zIndex: 2 }) };
        const result = buildDuplicatedElements(elements, ["a", "b"], { dx: 0, dy: 0 }, makeIdGenerator("id"), 100);
        expect(result.map((r) => r.element.zIndex)).toEqual([101, 102]);
        expect(result[0].element.startX).toBe(20); // b (lower source zIndex) sorted first
        expect(result[1].element.startX).toBe(50);
    });

    it("always unlocks a copy, even when the source was locked", () => {
        const elements = { a: shape(0, 0, 1, 1, { locked: true }) };
        const result = buildDuplicatedElements(elements, ["a"], { dx: 0, dy: 0 }, makeIdGenerator("id"), 0);
        expect(result[0].element.locked).toBe(false);
    });

    it("gives a fresh shared groupId to elements that shared one, not the original", () => {
        const elements = {
            a: shape(0, 0, 1, 1, { groupId: "g1" }),
            b: shape(0, 0, 1, 1, { groupId: "g1" }),
            c: shape(0, 0, 1, 1, { groupId: null }),
        };
        const result = buildDuplicatedElements(elements, ["a", "b", "c"], { dx: 0, dy: 0 }, makeIdGenerator("id"), 0);
        const [copyA, copyB, copyC] = result;
        expect(copyA.element.groupId).toBe(copyB.element.groupId);
        expect(copyA.element.groupId).not.toBe("g1");
        expect(copyC.element.groupId).toBeNull();
    });

    it("skips ids that no longer exist in elementsMap", () => {
        const elements = { a: shape(0, 0, 1, 1) };
        const result = buildDuplicatedElements(elements, ["a", "gone"], { dx: 0, dy: 0 }, makeIdGenerator("id"), 0);
        expect(result).toHaveLength(1);
    });

    it("joins a copied arrow to the copies of its ends and lets go of an end left behind", () => {
        const arrow = {
            type: "connector",
            startX: 10,
            startY: 5,
            endX: 50,
            endY: 5,
            startElementId: "a",
            endElementId: "b",
            startAnchor: { x: 1, y: 0.5 },
            endAnchor: { x: 0, y: 0.5 },
            zIndex: 3,
        };
        const elements = { a: shape(0, 0, 10, 10, { zIndex: 1 }), b: shape(50, 0, 60, 10, { zIndex: 2 }), arrow };
        const both = buildDuplicatedElements(elements, ["a", "b", "arrow"], { dx: 0, dy: 100 }, makeIdGenerator("n"), 10);
        const copiedArrow = both.find(({ element }) => element.type === "connector").element;
        const [copyA, copyB] = both.filter(({ element }) => element.type === "shape").map(({ elementId }) => elementId);
        expect(copiedArrow.startElementId).toBe(copyA);
        expect(copiedArrow.endElementId).toBe(copyB);

        const alone = buildDuplicatedElements(elements, ["a", "arrow"], { dx: 0, dy: 100 }, makeIdGenerator("m"), 10);
        const looseArrow = alone.find(({ element }) => element.type === "connector").element;
        expect(looseArrow.endElementId).toBeNull();
        expect(looseArrow.endAnchor).toBeNull();
        expect(looseArrow.endY).toBe(105);
    });
});
