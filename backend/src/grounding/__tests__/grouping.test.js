import { describe, it, expect } from "vitest";
import { buildCanonicalScene } from "../canonicalScene.js";
import { groupByStructuralSignals, groupByTemporalSignal, arbitrateGrouping, stabilizeGroupRefs, mintGroupRef } from "../groupingSignals.js";

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
    endX: 100,
    endY: 50,
    ...overrides,
});

const text = (overrides = {}) => ({
    type: "text",
    x: 0,
    y: 0,
    width: 60,
    text: "label",
    color: "#000000",
    size: 14,
    zIndex: 1,
    rotation: 0,
    ...overrides,
});

const path = (overrides = {}) => ({
    type: "path",
    points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
    ],
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...overrides,
});

const groupOf = (result, elementId, canonicalScene) => {
    const ref = canonicalScene.idToRef.get(elementId);
    return result.partitions.find((members) => members.includes(ref));
};

describe("groupByStructuralSignals", () => {
    it("never splits a user-created explicit group", () => {
        const elements = {
            a: shape({ groupId: "g1", startX: 0, startY: 0, endX: 20, endY: 20 }),
            b: shape({ groupId: "g1", startX: 500, startY: 500, endX: 520, endY: 520 }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(groupOf(result, "a", scene)).toEqual(groupOf(result, "b", scene));
    });

    it("merges a shape with its nearest attached label into one object", () => {
        const elements = {
            box: shape({ startX: 100, startY: 100, endX: 200, endY: 150 }),
            caption: text({ x: 100, y: 74, width: 100 }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(groupOf(result, "box", scene)).toEqual(groupOf(result, "caption", scene));
    });

    it("leaves a board of only structured, non-touching elements at one object per element", () => {
        const elements = {
            a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            b: shape({ startX: 300, startY: 300, endX: 350, endY: 350 }),
            c: text({ x: 600, y: 600, width: 60 }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(result.partitions).toHaveLength(3);
        result.partitions.forEach((members) => expect(members).toHaveLength(1));
    });

    it("never merges two adjacent structured shapes with no other signal", () => {
        const elements = {
            a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            b: shape({ startX: 51, startY: 0, endX: 100, endY: 50 }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(groupOf(result, "a", scene)).not.toEqual(groupOf(result, "b", scene));
    });

    it("absorbs a freehand stroke fully inside a shape as one object", () => {
        const elements = {
            box: shape({ startX: 0, startY: 0, endX: 100, endY: 100 }),
            checkmark: path({
                points: [
                    { x: 20, y: 20 },
                    { x: 40, y: 40 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(groupOf(result, "box", scene)).toEqual(groupOf(result, "checkmark", scene));
    });

    it("merges overlapping freehand strokes into one object", () => {
        const elements = {
            s1: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 20, y: 20 },
                ],
            }),
            s2: path({
                points: [
                    { x: 15, y: 15 },
                    { x: 35, y: 35 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(groupOf(result, "s1", scene)).toEqual(groupOf(result, "s2", scene));
    });

    it("does not merge two freehand strokes far apart with no adjacency", () => {
        const elements = {
            s1: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
            }),
            s2: path({
                points: [
                    { x: 900, y: 900 },
                    { x: 910, y: 910 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(groupOf(result, "s1", scene)).not.toEqual(groupOf(result, "s2", scene));
    });

    it("records the signal that caused every merge", () => {
        const elements = {
            a: shape({ groupId: "g1", startX: 0, startY: 0, endX: 20, endY: 20 }),
            b: shape({ groupId: "g1", startX: 500, startY: 500, endX: 520, endY: 520 }),
        };
        const scene = buildCanonicalScene(elements);
        const result = groupByStructuralSignals(scene.objects);
        expect(result.trace.some((entry) => entry.signal === "explicit-group")).toBe(true);
    });

    it("is deterministic and order-independent", () => {
        const elements = {
            b: path({
                points: [
                    { x: 15, y: 15 },
                    { x: 35, y: 35 },
                ],
            }),
            a: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 20, y: 20 },
                ],
            }),
        };
        const first = groupByStructuralSignals(buildCanonicalScene(elements).objects);
        const second = groupByStructuralSignals(buildCanonicalScene(elements).objects);
        expect(first.partitions).toEqual(second.partitions);
    });
});

describe("groupByTemporalSignal", () => {
    const authorId = "user-1";

    it("groups two strokes from one author drawn close together in time and space", () => {
        const elements = {
            s1: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
            }),
            s2: path({
                points: [
                    { x: 12, y: 12 },
                    { x: 20, y: 20 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const opLog = [
            { elementId: "s1", authorId, ts: 1000 },
            { elementId: "s2", authorId, ts: 1200 },
        ];
        const result = groupByTemporalSignal(scene.objects, opLog);
        expect(groupOf(result, "s1", scene)).toEqual(groupOf(result, "s2", scene));
    });

    it("keeps two strokes from different authors in the same spot as separate objects", () => {
        const elements = {
            s1: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
            }),
            s2: path({
                points: [
                    { x: 12, y: 12 },
                    { x: 20, y: 20 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const opLog = [
            { elementId: "s1", authorId: "user-1", ts: 1000 },
            { elementId: "s2", authorId: "user-2", ts: 1050 },
        ];
        const result = groupByTemporalSignal(scene.objects, opLog);
        expect(groupOf(result, "s1", scene)).not.toEqual(groupOf(result, "s2", scene));
    });

    it("does not merge two quick unrelated sketches drawn far apart", () => {
        const elements = {
            s1: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
            }),
            s2: path({
                points: [
                    { x: 900, y: 900 },
                    { x: 910, y: 910 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const opLog = [
            { elementId: "s1", authorId, ts: 1000 },
            { elementId: "s2", authorId, ts: 1050 },
        ];
        const result = groupByTemporalSignal(scene.objects, opLog);
        expect(groupOf(result, "s1", scene)).not.toEqual(groupOf(result, "s2", scene));
    });

    it("reports degraded when the board has no op-log history", () => {
        const elements = { s1: path() };
        const scene = buildCanonicalScene(elements);
        const result = groupByTemporalSignal(scene.objects, []);
        expect(result.degraded).toBe(true);
    });
});

describe("arbitrateGrouping", () => {
    it("gives a solo object full confidence", () => {
        const elements = { a: shape() };
        const scene = buildCanonicalScene(elements);
        const structural = groupByStructuralSignals(scene.objects);
        const temporal = groupByTemporalSignal(scene.objects, []);
        const arbitrated = arbitrateGrouping(structural, temporal, scene.objects);
        expect(arbitrated.groups).toHaveLength(1);
        expect(arbitrated.groups[0].confidence).toBe(1);
    });

    it("unions structural and temporal merges rather than letting one override the other", () => {
        // ~170px: beyond the structural z-order radius (150px), within the temporal one (200px), so
        // only the temporal pass merges and arbitration must keep it.
        const elements = {
            a: path({
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
            }),
            b: path({
                points: [
                    { x: 130, y: 130 },
                    { x: 140, y: 140 },
                ],
            }),
        };
        const scene = buildCanonicalScene(elements);
        const structural = groupByStructuralSignals(scene.objects);
        const temporal = groupByTemporalSignal(scene.objects, [
            { elementId: "a", authorId: "u1", ts: 0 },
            { elementId: "b", authorId: "u1", ts: 100 },
        ]);
        const arbitrated = arbitrateGrouping(structural, temporal, scene.objects);
        expect(arbitrated.groups).toHaveLength(1);
    });
});

describe("stabilizeGroupRefs", () => {
    it("preserves a group's ref when a stroke is added to it", () => {
        const usedRefs = new Set();
        const previous = [{ ref: "grp_abc123", memberRefs: ["r1", "r2"] }];
        const result = stabilizeGroupRefs([{ memberRefs: ["r1", "r2", "r3"] }], previous, usedRefs);
        expect(result.groups[0].ref).toBe("grp_abc123");
    });

    it("retires a split group's ref and mints fresh refs for both halves", () => {
        const usedRefs = new Set(["grp_abc123"]);
        const previous = [{ ref: "grp_abc123", memberRefs: ["r1", "r2"] }];
        const result = stabilizeGroupRefs([{ memberRefs: ["r1"] }, { memberRefs: ["r2"] }], previous, usedRefs);
        expect(result.groups.map((g) => g.ref)).not.toContain("grp_abc123");
        expect(result.retiredRefs).toContain("grp_abc123");
    });

    it("keeps the larger contributor's ref on a merge", () => {
        const usedRefs = new Set(["grp_big", "grp_small"]);
        const previous = [
            { ref: "grp_big", memberRefs: ["r1", "r2", "r3"] },
            { ref: "grp_small", memberRefs: ["r4"] },
        ];
        const result = stabilizeGroupRefs([{ memberRefs: ["r1", "r2", "r3", "r4"] }], previous, usedRefs);
        expect(result.groups[0].ref).toBe("grp_big");
    });

    it("never reuses a ref already in usedRefs when minting a fresh one", () => {
        const collidingRef = mintGroupRef(["r1", "r2"]);
        const usedRefs = new Set([collidingRef]);
        const result = stabilizeGroupRefs([{ memberRefs: ["r1", "r2"] }], [], usedRefs);
        expect(result.groups[0].ref).not.toBe(collidingRef);
    });
});
