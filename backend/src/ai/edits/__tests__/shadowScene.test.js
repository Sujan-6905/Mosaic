import { describe, it, expect } from "vitest";
import { applyBatchToShadowScene, diffShadowScene, buildGroupIndex } from "../shadowScene.js";

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

const objectsFor = (elements) =>
    Object.entries(elements).map(([elementId, element]) => ({ ref: elementId, memberElementIds: [elementId], type: element.type }));

describe("applyBatchToShadowScene", () => {
    it("leaves the live board provably untouched", () => {
        const elements = { a: shape() };
        const original = elements.a;
        const groupIndex = buildGroupIndex(objectsFor(elements));

        applyBatchToShadowScene(elements, groupIndex, [{ op: "restyle", ref: "a", props: { color: "red" } }]);

        expect(elements.a).toBe(original);
        expect(elements.a.color).toBe("#000000");
    });

    it("lets a later operation see an earlier operation's effect within the same batch", () => {
        const elements = { a: shape() };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const { shadow } = applyBatchToShadowScene(elements, groupIndex, [{ op: "duplicate", ref: "a", relation: "right-of" }]);
        const duplicateId = Object.keys(shadow).find((id) => id !== "a");
        expect(duplicateId).toBeTruthy();
        expect(shadow[duplicateId].startX).toBeGreaterThan(shadow.a.startX);
    });

    it("reports a failed operation without aborting the whole batch", () => {
        const elements = { a: shape() };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const { shadow, opResults } = applyBatchToShadowScene(elements, groupIndex, [
            { op: "restyle", ref: "missing", props: { color: "red" } },
            { op: "restyle", ref: "a", props: { color: "blue" } },
        ]);
        expect(opResults[0].applied).toBe(false);
        expect(opResults[1].applied).toBe(true);
        expect(shadow.a.color).toBe("blue");
    });
});

describe("diffShadowScene", () => {
    it("matches the existing diff vocabulary", () => {
        const before = { a: shape(), b: shape({ startX: 200, endX: 250 }) };
        const after = {
            a: { ...before.a, startX: before.a.startX + 100, endX: before.a.endX + 100 },
            c: shape({ startX: 900, endX: 950 }),
        };
        const diff = diffShadowScene(before, after);
        expect(diff.moved.map((entry) => entry.elementId)).toEqual(["a"]);
        expect(diff.removed.map((entry) => entry.elementId)).toEqual(["b"]);
        expect(diff.added.map((entry) => entry.elementId)).toEqual(["c"]);
    });

    it("reports no changes for an untouched board", () => {
        const elements = { a: shape() };
        const diff = diffShadowScene(elements, { ...elements });
        expect(diff.added).toHaveLength(0);
        expect(diff.removed).toHaveLength(0);
        expect(diff.moved).toHaveLength(0);
        expect(diff.modified).toHaveLength(0);
    });
});

describe("batch refs", () => {
    const add = (text) => ({ op: "add", kind: "sticky", text });

    it("lets later ops name what earlier ops created, in creation order", () => {
        const { shadow, opResults } = applyBatchToShadowScene({}, buildGroupIndex([]), [
            add("one"),
            add("two"),
            { op: "frame", refs: ["new1", "new2"], name: "Ideas" },
        ]);
        expect(opResults.every((result) => result.applied)).toBe(true);
        const frame = Object.entries(shadow).find(([, element]) => element.type === "frame");
        expect(Object.values(shadow).filter((element) => element.frameId === frame[0])).toHaveLength(2);
    });

    it("keeps the numbering when an op is skipped, so a dependant fails rather than hitting the wrong item", () => {
        const { opResults } = applyBatchToShadowScene({}, buildGroupIndex([]), [add("one"), add("two"), { op: "lock", refs: ["new1"] }], new Set([0]));
        expect(opResults[0]).toMatchObject({ skipped: true });
        expect(opResults[2]).toMatchObject({ applied: false });
    });
});
