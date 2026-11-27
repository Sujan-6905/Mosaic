import { describe, it, expect } from "vitest";
import { buildCanonicalScene, elementIdToRef } from "../canonicalScene.js";

const shape = (overrides = {}) => ({
    type: "shape",
    shapeType: "rectangle",
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 50,
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...overrides,
});

describe("buildCanonicalScene", () => {
    it("assigns the same ref to the same element id across independent rebuilds", () => {
        const elements = { "el-1": shape() };
        const first = buildCanonicalScene(elements);
        const second = buildCanonicalScene(elements);
        expect(first.objects[0].ref).toBe(second.objects[0].ref);
    });

    it("assigns different refs to different element ids", () => {
        const scene = buildCanonicalScene({ "el-1": shape(), "el-2": shape() });
        const [a, b] = scene.objects;
        expect(a.ref).not.toBe(b.ref);
    });

    it("looks up an element's ref", () => {
        const scene = buildCanonicalScene({ "el-1": shape() });
        expect(elementIdToRef(scene, "el-1")).toBe(scene.objects[0].ref);
    });

    it("skips a path with no computable bounds instead of throwing", () => {
        const scene = buildCanonicalScene({ "el-1": { type: "path", points: [] } });
        expect(scene.objects).toHaveLength(0);
    });

    it("re-points frameId and connector bindings at refs, not raw element ids", () => {
        const elements = {
            frame: { type: "frame", startX: 0, startY: 0, endX: 200, endY: 200, name: "Zone", color: "#000", zIndex: 0, rotation: 0 },
            child: shape({ frameId: "frame" }),
            connector: {
                type: "connector",
                startX: 0,
                startY: 0,
                endX: 10,
                endY: 10,
                startElementId: "frame",
                endElementId: "child",
                color: "#000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 2,
                rotation: 0,
            },
        };
        const scene = buildCanonicalScene(elements);
        const frameRef = elementIdToRef(scene, "frame");
        const childRef = elementIdToRef(scene, "child");
        const childObject = scene.objects.find((o) => o.elementId === "child");
        const connectorObject = scene.objects.find((o) => o.elementId === "connector");

        expect(childObject.frameId).toBe(frameRef);
        expect(connectorObject.startElementId).toBe(frameRef);
        expect(connectorObject.endElementId).toBe(childRef);
    });
});
