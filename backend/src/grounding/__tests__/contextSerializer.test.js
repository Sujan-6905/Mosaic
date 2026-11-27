import { describe, it, expect } from "vitest";
import { buildCanonicalScene } from "../canonicalScene.js";
import { buildGroundedScene } from "../buildGroundedScene.js";
import { serializeSceneContext } from "../contextSerializer.js";

const namedShape = (id, name) => [
    id,
    {
        type: "shape",
        shapeType: "rectangle",
        startX: 0,
        startY: 0,
        endX: 50,
        endY: 50,
        color: "#000000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
        name, // not a real schema field, harmless extra key for the fixture
    },
];

describe("serializeSceneContext", () => {
    it("includes every object and relation when well under budget", () => {
        const scene = { ...buildCanonicalScene(Object.fromEntries([namedShape("a", null)])), relations: [] };
        const context = serializeSceneContext(scene);
        expect(context.objects).toHaveLength(1);
        expect(context.truncated).toBe(false);
    });

    it("never emits a coordinate field on a projected object", () => {
        const scene = { ...buildCanonicalScene(Object.fromEntries([namedShape("a", null)])), relations: [] };
        const context = serializeSceneContext(scene);
        expect(context.objects[0]).not.toHaveProperty("bounds");
        expect(context.objects[0]).not.toHaveProperty("startX");
    });

    it("drops relations that reference an object cut for budget, keeping the payload internally consistent", () => {
        const elements = Object.fromEntries(Array.from({ length: 5 }, (_, i) => namedShape(`el-${i}`, null)));
        const scene = buildCanonicalScene(elements);
        const refs = scene.objects.map((o) => o.ref);
        const groundedScene = { ...scene, relations: [[refs[0], "aligned-with", refs[1]]] };

        // The budget always keeps one object, so it's sized for exactly one and the second is cut.
        const oneObjectSize = JSON.stringify({ ref: refs[0], kind: "shape" }).length;
        const context = serializeSceneContext(groundedScene, { charBudget: oneObjectSize + 40 });

        expect(context.truncated).toBe(true);
        expect(context.objects.length).toBeLessThan(5);
        const includedRefs = new Set(context.objects.map((o) => o.ref));
        for (const [subject, , object] of context.relations) {
            expect(includedRefs.has(subject)).toBe(true);
            expect(includedRefs.has(object)).toBe(true);
        }
    });

    it("always includes at least one object even under an unreasonably small budget", () => {
        const scene = { ...buildCanonicalScene(Object.fromEntries([namedShape("a", null)])), relations: [] };
        const context = serializeSceneContext(scene, { charBudget: 1 });
        expect(context.objects).toHaveLength(1);
    });

    it("describes a grouped cluster by what it holds and lists its members", async () => {
        const sticky = (x, text) => ({
            type: "sticky",
            x,
            y: 0,
            width: 120,
            height: 80,
            text,
            color: "#000000",
            fillColor: "#bbf7d0",
            size: 14,
            zIndex: 1,
            rotation: 0,
            groupId: "cluster",
        });
        const groundedScene = await buildGroundedScene("serializer-group", {
            a: sticky(0, "Design review"),
            b: sticky(140, "Ship v1"),
            c: sticky(280, "Launch email"),
        });

        const [group] = serializeSceneContext(groundedScene).objects;
        expect(group).toMatchObject({ kind: "group", name: "group of 3 sticky notes" });
        expect(group.members).toEqual(expect.arrayContaining(["Design review", "Ship v1", "Launch email"]));
    });

    it("names an unlabelled member by its shape type, so a labelled diamond reads as one", async () => {
        const groundedScene = await buildGroundedScene("serializer-labelled-shape", {
            diamond: {
                type: "shape",
                shapeType: "Diamond",
                startX: 0,
                startY: 0,
                endX: 200,
                endY: 120,
                color: "#000000",
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
            label: { type: "text", x: 60, y: 50, width: 80, text: "Approved?", color: "#000000", size: 14, zIndex: 2, rotation: 0 },
        });

        const [group] = serializeSceneContext(groundedScene).objects;
        expect(group).toMatchObject({ kind: "group", name: "Approved?" });
        expect(group.members).toEqual(expect.arrayContaining(["Approved?", "Diamond"]));
    });
});

describe("hand-drawn and budget-bound context", () => {
    const bounds = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });
    const canonical = (ref, type, box, extra = {}) => ({ ref, type, bounds: box, name: null, stroke: null, ...extra });

    const sketchScene = () => {
        const left = canonical("c_left", "path", bounds(0, 0, 100, 80), { stroke: { kind: "closed", shapeType: "Rectangle" } });
        const label = canonical("c_label", "text", bounds(20, 20, 80, 40), { name: "orange" });
        const right = canonical("c_right", "path", bounds(300, 0, 400, 80), { stroke: { kind: "closed", shapeType: "Rectangle" } });
        const arrow = canonical("c_arrow", "path", bounds(110, 40, 290, 42), {
            stroke: { kind: "line", shapeType: "Line", start: { x: 110, y: 40 }, end: { x: 290, y: 40 } },
        });
        return {
            objects: [
                { ref: "obj_left", type: "group", name: "orange", bounds: bounds(0, 0, 100, 80), memberRefs: ["c_left", "c_label"] },
                { ref: "obj_right", type: "group", name: "right", bounds: bounds(300, 0, 400, 80), memberRefs: ["c_right"] },
                { ref: "obj_arrow", type: "path", name: "arrow", bounds: bounds(110, 40, 290, 42), memberRefs: ["c_arrow"] },
            ],
            relations: [],
            canonicalScene: { objects: [left, label, right, arrow] },
        };
    };

    it("says what strokes look like and what's written on them", () => {
        const [left] = serializeSceneContext(sketchScene()).objects;
        expect(left.text).toEqual(["orange"]);
        expect(left.drawn).toEqual(["box"]);
    });

    it("works out which way a hand-drawn arrow points", () => {
        expect(serializeSceneContext(sketchScene()).relations).toContainEqual(["obj_left", "arrow-to", "obj_right"]);
    });

    it("hides text that reads like instructions but keeps the object addressable", () => {
        const context = serializeSceneContext(sketchScene(), { suspectRefs: ["obj_left"] });
        const left = context.objects.find((object) => object.ref === "obj_left");
        expect(JSON.stringify(left)).not.toContain("orange");
        expect(left.name).toContain("hidden");
    });

    it("caps relations, which grow with the square of nearby objects", () => {
        const objects = Array.from({ length: 30 }, (_, i) => ({
            ref: `obj_${i}`,
            type: "shape",
            name: `n${i}`,
            bounds: bounds(i, i, i + 1, i + 1),
            memberRefs: [],
        }));
        const relations = objects.flatMap((a) => objects.map((b) => [a.ref, "aligned-with", b.ref]));
        const context = serializeSceneContext({ objects, relations, canonicalScene: { objects: [] } }, { charBudget: 3000 });
        expect(JSON.stringify(context.relations).length).toBeLessThanOrEqual(3000 * 0.3 + 2);
    });

    it("keeps a selected object's relations ahead of the rest when cutting", () => {
        const objects = Array.from({ length: 30 }, (_, i) => ({
            ref: `obj_${i}`,
            type: "shape",
            name: `n${i}`,
            bounds: bounds(i, i, i + 1, i + 1),
            memberRefs: [],
        }));
        const relations = [...objects.slice(1).flatMap((a) => objects.slice(1).map((b) => [a.ref, "aligned-with", b.ref])), ["obj_0", "aligned-with", "obj_1"]];
        const context = serializeSceneContext({ objects, relations, canonicalScene: { objects: [] } }, { charBudget: 3000, selection: ["obj_0"] });
        expect(context.relations[0]).toEqual(["obj_0", "aligned-with", "obj_1"]);
    });
});
