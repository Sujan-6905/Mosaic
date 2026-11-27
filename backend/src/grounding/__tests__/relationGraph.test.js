import { describe, it, expect } from "vitest";
import { buildCanonicalScene } from "../canonicalScene.js";
import { buildRelationGraph } from "../relationGraph.js";

const shape = (id, bounds) => [
    id,
    {
        type: "shape",
        shapeType: "rectangle",
        startX: bounds.minX,
        startY: bounds.minY,
        endX: bounds.maxX,
        endY: bounds.maxY,
        color: "#000000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    },
];

describe("buildRelationGraph", () => {
    it("reports the lower object as the subject of 'below', not the reverse", () => {
        // top sits above bottom (smaller y); the winner of the "below"
        // slot must be the object that's actually positioned lower.
        const elements = Object.fromEntries([
            shape("top", { minX: 0, minY: 0, maxX: 50, maxY: 50 }),
            shape("bottom", { minX: 0, minY: 300, maxX: 50, maxY: 350 }),
        ]);
        const scene = buildCanonicalScene(elements);
        const relations = buildRelationGraph(scene.objects);
        const topRef = scene.idToRef.get("top");
        const bottomRef = scene.idToRef.get("bottom");

        expect(relations).toContainEqual([bottomRef, "below", topRef]);
        expect(relations).not.toContainEqual([topRef, "below", bottomRef]);
    });

    it("reports containment as [inner, inside, outer]", () => {
        const elements = Object.fromEntries([
            shape("outer", { minX: 0, minY: 0, maxX: 200, maxY: 200 }),
            shape("inner", { minX: 20, minY: 20, maxX: 80, maxY: 80 }),
        ]);
        const scene = buildCanonicalScene(elements);
        const relations = buildRelationGraph(scene.objects);
        const outerRef = scene.idToRef.get("outer");
        const innerRef = scene.idToRef.get("inner");

        expect(relations).toContainEqual([innerRef, "inside", outerRef]);
    });

    it("does not let a connector's own bounds compete for directional neighbor slots", () => {
        const elements = {
            a: shape("a", { minX: 0, minY: 0, maxX: 50, maxY: 50 })[1],
            b: shape("b", { minX: 0, minY: 300, maxX: 50, maxY: 350 })[1],
            arrow: {
                type: "connector",
                startX: 25,
                startY: 50,
                endX: 25,
                endY: 300,
                startElementId: "a",
                endElementId: "b",
                color: "#000000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 2,
                rotation: 0,
            },
        };
        const scene = buildCanonicalScene(elements);
        const relations = buildRelationGraph(scene.objects);
        const aRef = scene.idToRef.get("a");
        const bRef = scene.idToRef.get("b");
        const arrowRef = scene.idToRef.get("arrow");

        expect(relations).toContainEqual([bRef, "below", aRef]);
        expect(relations.some((r) => r.includes(arrowRef) && r[1] !== "connected-to")).toBe(false);
    });

    it("derives connected-to from a connector's bound endpoints", () => {
        const elements = {
            a: shape("a", { minX: 0, minY: 0, maxX: 50, maxY: 50 })[1],
            b: shape("b", { minX: 100, minY: 0, maxX: 150, maxY: 50 })[1],
            arrow: {
                type: "connector",
                startX: 50,
                startY: 25,
                endX: 100,
                endY: 25,
                startElementId: "a",
                endElementId: "b",
                color: "#000000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 2,
                rotation: 0,
            },
        };
        const scene = buildCanonicalScene(elements);
        const relations = buildRelationGraph(scene.objects);
        const aRef = scene.idToRef.get("a");
        const bRef = scene.idToRef.get("b");

        expect(relations).toContainEqual([aRef, "connected-to", bRef]);
    });
});
