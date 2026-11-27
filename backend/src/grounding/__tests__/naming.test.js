import { describe, it, expect } from "vitest";
import { buildCanonicalScene } from "../canonicalScene.js";
import { attachNearestLabels } from "../labelAttachment.js";
import { nameObjects } from "../naming.js";

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
    name: "Sprint",
    color: "#000000",
    zIndex: 0,
    rotation: 0,
    startX: 0,
    startY: 0,
    endX: 1000,
    endY: 1000,
    ...overrides,
});

const asGroups = (elements) => {
    const scene = buildCanonicalScene(elements);
    // Solo groups: naming only needs the grouped-object shape.
    return scene.objects.map((object) => ({ ...object, memberRefs: [object.ref], memberElementIds: [object.elementId] }));
};

describe("nameObjects", () => {
    it("gives every object a non-empty name with no label or frame available", () => {
        const elements = { a: shape() };
        const scene = buildCanonicalScene(elements);
        const objects = asGroups(elements);
        const boardBounds = objects[0].bounds;
        const named = nameObjects(objects, scene, [], boardBounds);
        expect(named[0].name).toBeTruthy();
    });

    it("falls back to a type-and-position description with vision unavailable", () => {
        const elements = { a: shape({ startX: 900, startY: 900, endX: 950, endY: 950 }) };
        const scene = buildCanonicalScene(elements);
        const objects = asGroups(elements);
        const boardBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
        const named = nameObjects(objects, scene, [], boardBounds, () => null);
        expect(named[0].name).toMatch(/rectangle/);
        expect(named[0].name).toMatch(/bottom right/);
    });

    it("names an object after its containing frame when nothing more specific is available", () => {
        const elements = {
            container: frame(),
            child: shape({ frameId: "container", startX: 10, startY: 10, endX: 60, endY: 60 }),
        };
        const scene = buildCanonicalScene(elements);
        const objects = asGroups(elements);
        const boardBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
        const named = nameObjects(objects, scene, [], boardBounds);
        const child = named.find((object) => object.memberElementIds.includes("child"));
        // Collides with the frame itself (also named "Sprint"): qualified
        // by position rather than "(in Sprint)", which would be redundant.
        expect(child.name).toBe("Sprint (top left)");
    });

    it("disambiguates duplicate names with a human-meaningful qualifier, not a numeric suffix", () => {
        const elements = {
            a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            b: shape({ startX: 900, startY: 900, endX: 950, endY: 950 }),
        };
        const scene = buildCanonicalScene(elements);
        const objects = asGroups(elements);
        const boardBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
        const named = nameObjects(objects, scene, [], boardBounds);
        const names = named.map((object) => object.name);
        expect(new Set(names).size).toBe(2);
        names.forEach((name) => expect(name).not.toMatch(/\s\d$/));
    });

    it("names a shape after its nearest label", () => {
        const elements = {
            box: shape({ startX: 100, startY: 100, endX: 200, endY: 150 }),
            label: { type: "text", x: 100, y: 74, width: 100, text: "Login", color: "#000", size: 14, zIndex: 2, rotation: 0 },
        };
        const scene = buildCanonicalScene(elements);
        // Label and box stay separate objects, related only through the relation graph.
        const objects = asGroups(elements);
        const relations = attachNearestLabels(objects);
        const boardBounds = { minX: 0, minY: 0, maxX: 300, maxY: 300 };
        const named = nameObjects(objects, scene, relations, boardBounds);
        const box = named.find((object) => object.memberElementIds.includes("box"));
        // The label element's own text is also "Login", so the two names are disambiguated.
        expect(box.name).toContain("Login");
    });
});
