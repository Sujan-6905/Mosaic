import { describe, it, expect } from "vitest";
import { buildGroupIndex, executeOperation } from "../index.js";

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

// A stand-in grouped object, so group-rigid behaviour is tested without the grouping pass.
const withGroup = (objects, ref, memberElementIds) => [...objects, { ref, memberElementIds, type: "group" }];

describe("executeOperation", () => {
    it("aligns two objects to a shared left edge", () => {
        const elements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 100, endX: 150 }) };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "align", refs: ["a", "b"], edge: "left" });
        expect(result.updatedById.b.startX).toBe(0);
        expect(result.updatedById.b.endX).toBe(50);
    });

    it("moves a grouped object as one rigid body, preserving internal arrangement", () => {
        const elements = {
            top: shape({ startX: 0, startY: 0, endX: 50, endY: 20 }),
            bottom: shape({ startX: 0, startY: 30, endX: 50, endY: 50 }),
            anchor: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }),
        };
        const objects = withGroup(objectsFor(elements), "grp_1", ["top", "bottom"]);
        const groupIndex = buildGroupIndex(objects);

        const result = executeOperation(elements, groupIndex, { op: "place", ref: "grp_1", relation: "right-of", anchorRef: "anchor" });

        const newTop = result.updatedById.top;
        const newBottom = result.updatedById.bottom;
        // The pair's 10px gap and shared width are unchanged; only the whole pair moved.
        expect(newBottom.startY - newTop.endY).toBe(10);
        expect(newTop.endX - newTop.startX).toBe(50);
    });

    it("aligns a lone group's members against each other when it is the only ref", () => {
        const elements = { a: shape({ startX: 0, endX: 50 }), b: shape({ startX: 100, endX: 150 }), c: shape({ startX: 220, endX: 270 }) };
        const groupIndex = buildGroupIndex(withGroup(objectsFor(elements), "grp_1", ["a", "b", "c"]));

        const result = executeOperation(elements, groupIndex, { op: "align", refs: ["grp_1"], edge: "left" });

        expect(result.updatedById.b.startX).toBe(0);
        expect(result.updatedById.c.startX).toBe(0);
    });

    it("keeps a labelled shape whole when it is the only ref", () => {
        const elements = {
            box: shape({ startX: 0, startY: 0, endX: 200, endY: 100 }),
            label: { type: "text", x: 80, y: 40, width: 40, text: "Login", color: "#000000", size: 14, zIndex: 2, rotation: 0 },
        };
        const groupIndex = buildGroupIndex(withGroup(objectsFor(elements), "grp_1", ["box", "label"]));

        const result = executeOperation(elements, groupIndex, { op: "align", refs: ["grp_1"], edge: "left" });

        expect(result.updatedById).toEqual({});
    });

    it("re-derives a bound connector's anchor after the element it's bound to moves", () => {
        const elements = {
            a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            b: shape({ startX: 500, startY: 500, endX: 550, endY: 550 }),
            connector: {
                type: "connector",
                startX: 25,
                startY: 25,
                endX: 525,
                endY: 525,
                startElementId: "a",
                endElementId: "b",
                color: "#000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 3,
                rotation: 0,
            },
        };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "align", refs: ["a", "b"], edge: "left" });
        expect(result.updatedById.connector.startX).toBe(25);
    });

    it("updates frame membership when a move carries an element into a frame's bounds", () => {
        const elements = {
            frame: { type: "frame", startX: 100, startY: 100, endX: 400, endY: 400, name: "Zone", color: "#000", zIndex: 0, rotation: 0 },
            child: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            anchorInside: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }),
        };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "place", ref: "child", relation: "inside", anchorRef: "anchorInside" });
        expect(result.updatedById.child.frameId).toBe("frame");
    });

    it("connect creates a connector bound to both refs", () => {
        const elements = { a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }), b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }) };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "connect", refA: "a", refB: "b" });
        const [connector] = Object.values(result.newElementsById);
        expect(connector.type).toBe("connector");
        expect(connector.startElementId).toBe("a");
        expect(connector.endElementId).toBe("b");
    });

    it("disconnect deletes the connector between two refs", () => {
        const elements = {
            a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            b: shape({ startX: 200, startY: 200, endX: 250, endY: 250 }),
            connector: {
                type: "connector",
                startX: 25,
                startY: 25,
                endX: 225,
                endY: 225,
                startElementId: "a",
                endElementId: "b",
                color: "#000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 3,
                rotation: 0,
            },
        };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "disconnect", refA: "a", refB: "b" });
        expect(result.deletedIds).toContain("connector");
    });

    it("restyle normalises to only the properties the element type supports", () => {
        const elements = { a: { type: "text", x: 0, y: 0, text: "hi", color: "#000", opacity: 100, zIndex: 1, rotation: 0 } };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "restyle", ref: "a", props: { color: "red", fillColor: "blue" } });
        expect(result.updatedById.a.color).toBe("red");
        expect(result.updatedById.a.fillColor).toBeUndefined();
    });

    const stroke = (points, overrides = {}) => ({
        type: "path",
        points: points.map(([x, y]) => ({ x, y })),
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
        ...overrides,
    });

    it("restyle fills a closed pen stroke, which is how a sketch gets its colours", () => {
        const elements = {
            a: stroke([
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
            ]),
        };
        const result = executeOperation(elements, buildGroupIndex(objectsFor(elements)), { op: "restyle", ref: "a", props: { fillColor: "#c0392b" } });
        expect(result.updatedById.a.fillColor).toBe("#c0392b");
    });

    it("restyle puts a fill on an open stroke's ink, since it has no inside to fill", () => {
        const elements = {
            a: stroke(
                [
                    [0, 0],
                    [10, 2],
                    [20, 0],
                ],
                { colorToken: "ink-primary" },
            ),
        };
        const result = executeOperation(elements, buildGroupIndex(objectsFor(elements)), { op: "restyle", ref: "a", props: { fillColor: "#c0392b" } });
        expect(result.updatedById.a.fillColor).toBeUndefined();
        expect(result.updatedById.a.color).toBe("#c0392b");
        expect(result.updatedById.a.colorToken).toBeNull();
    });

    it("resize scales around the middle of everything named and keeps the arrangement", () => {
        const elements = { a: shape({ startX: 0, endX: 100, startY: 0, endY: 100 }), b: shape({ startX: 200, endX: 300, startY: 0, endY: 100 }) };
        const result = executeOperation(elements, buildGroupIndex(objectsFor(elements)), { op: "resize", refs: ["a", "b"], factor: 2 });
        expect(result.updatedById.a.startX).toBe(-150);
        expect(result.updatedById.b.endX).toBe(450);
    });

    it("resize grows text with its box rather than only rewrapping it", () => {
        const elements = { a: { type: "text", x: 0, y: 0, width: 100, text: "hi", color: "#000", size: 16, opacity: 100, zIndex: 1, rotation: 0 } };
        const result = executeOperation(elements, buildGroupIndex(objectsFor(elements)), { op: "resize", refs: ["a"], factor: 1.5 });
        expect(result.updatedById.a.size).toBe(24);
    });

    it("move goes by a step relative to the thing's own size, never less than a visible distance", () => {
        const big = { a: shape({ startX: 0, endX: 1000 }) };
        expect(
            executeOperation(big, buildGroupIndex(objectsFor(big)), { op: "move", refs: ["a"], direction: "right", distance: "medium" }).updatedById.a.startX,
        ).toBe(600);
        const small = { a: shape({ startX: 0, endX: 10, startY: 0, endY: 10 }) };
        expect(
            executeOperation(small, buildGroupIndex(objectsFor(small)), { op: "move", refs: ["a"], direction: "up", distance: "large" }).updatedById.a.startY,
        ).toBe(-300);
    });

    it("rotate turns several things around their shared centre", () => {
        const elements = { a: shape({ startX: 0, endX: 100, startY: 0, endY: 100 }), b: shape({ startX: 200, endX: 300, startY: 0, endY: 100 }) };
        const { a, b } = executeOperation(elements, buildGroupIndex(objectsFor(elements)), { op: "rotate", refs: ["a", "b"], degrees: 90 }).updatedById;
        expect(a.rotation).toBe(90);
        expect(b.rotation).toBe(90);
        expect(a.startY).toBeLessThan(0);
        expect(b.startY).toBeGreaterThan(0);
    });

    it("drawParts adds real strokes at the given board coordinates, as one sketch", () => {
        const op = {
            op: "drawParts",
            title: "a sun",
            color: "#111111",
            colorToken: "ink-primary",
            parts: [
                {
                    name: "sun",
                    fill: "#ffcc00",
                    strokes: [
                        {
                            points: [
                                { x: 500, y: 500 },
                                { x: 600, y: 500 },
                                { x: 600, y: 600 },
                            ],
                            closed: true,
                            smooth: false,
                        },
                    ],
                },
                {
                    name: "ray",
                    fill: "#ffcc00",
                    strokes: [
                        {
                            points: [
                                { x: 500, y: 490 },
                                { x: 500, y: 450 },
                            ],
                            closed: false,
                            smooth: false,
                        },
                    ],
                },
            ],
        };
        const { newElementsById } = executeOperation({}, buildGroupIndex([]), op);
        const [sun, ray] = Object.values(newElementsById);
        expect(sun).toMatchObject({ type: "path", label: "sun", fillColor: "#ffcc00", sketchTitle: "a sun", color: "#111111" });
        expect(ray).toMatchObject({ label: "ray", color: "#ffcc00", colorToken: null });
        expect(ray.fillColor).toBeUndefined();
        expect(sun.sketchId).toBe(ray.sketchId);
        expect(sun.points[0]).toMatchObject({ x: 500, y: 500 });
    });

    it("a duplicated sketch is a sketch of its own", () => {
        const elements = {
            a: stroke(
                [
                    [0, 0],
                    [10, 0],
                ],
                { sketchId: "one" },
            ),
            b: stroke(
                [
                    [0, 5],
                    [10, 5],
                ],
                { sketchId: "one" },
            ),
        };
        const objects = withGroup(objectsFor(elements), "whole", ["a", "b"]);
        const { newElementsById } = executeOperation(elements, buildGroupIndex(objects), { op: "duplicate", ref: "whole", relation: "right-of" });
        const ids = new Set(Object.values(newElementsById).map((element) => element.sketchId));
        expect(ids.size).toBe(1);
        expect(ids.has("one")).toBe(false);
    });

    it("group assigns a shared groupId across every member of every ref", () => {
        const elements = { a: shape(), b: shape({ startX: 100, endX: 150 }) };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "group", refs: ["a", "b"] });
        expect(result.updatedById.a.groupId).toBe(result.updatedById.b.groupId);
        expect(result.updatedById.a.groupId).toBeTruthy();
    });

    it("delete resolves every member of every given ref", () => {
        const elements = { a: shape(), b: shape({ startX: 100, endX: 150 }) };
        const objects = withGroup(objectsFor(elements), "grp_1", ["a", "b"]);
        const groupIndex = buildGroupIndex(objects);
        const result = executeOperation(elements, groupIndex, { op: "delete", refs: ["grp_1"] });
        expect(result.deletedIds.sort()).toEqual(["a", "b"]);
    });

    it("fails one bad operation without throwing", () => {
        const elements = { a: shape() };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "place", ref: "a", relation: "below", anchorRef: "does-not-exist" });
        expect(result.error).toBeTruthy();
    });

    it("tidy repositions refs without changing each one's own size", () => {
        const elements = {
            a: shape({ startX: 0, startY: 0, endX: 50, endY: 50 }),
            b: shape({ startX: 500, startY: 500, endX: 550, endY: 550 }),
        };
        const groupIndex = buildGroupIndex(objectsFor(elements));
        const result = executeOperation(elements, groupIndex, { op: "tidy", refs: ["a", "b"], direction: "left-right" });
        const newA = result.updatedById.a || elements.a;
        expect(newA.endX - newA.startX).toBe(50);
    });
});

describe("add", () => {
    const shape = {
        type: "shape",
        shapeType: "Rectangle",
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100,
        color: "#000",
        size: 2,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    };
    const index = buildGroupIndex([{ ref: "obj_a", memberElementIds: ["a"] }]);

    it("adds a sticky beside its anchor with the requested text", () => {
        const result = executeOperation({ a: shape }, index, { op: "add", kind: "sticky", text: "review this", relation: "right-of", anchorRef: "obj_a" });
        const [sticky] = Object.values(result.newElementsById);
        expect(sticky).toMatchObject({ type: "sticky", text: "review this" });
        expect(sticky.x).toBeGreaterThan(100);
    });

    it("adds a labelled shape as a shape plus a text element", () => {
        const result = executeOperation({ a: shape }, index, { op: "add", kind: "diamond", text: "Valid?", fillColor: "#3b82f6" });
        const added = Object.values(result.newElementsById);
        expect(added.map((element) => element.type).sort()).toEqual(["shape", "text"]);
        expect(added.find((element) => element.type === "shape")).toMatchObject({ shapeType: "Diamond", fillColor: "#3b82f6" });
    });

    it("lands clear of existing content when there is no anchor", () => {
        const result = executeOperation({ a: shape }, index, { op: "add", kind: "text", text: "hello" });
        expect(Object.values(result.newElementsById)[0].x).toBeGreaterThan(100);
    });

    it("works on an empty board", () => {
        const result = executeOperation({}, buildGroupIndex([]), { op: "add", kind: "text", text: "hello" });
        expect(Object.values(result.newElementsById)).toHaveLength(1);
    });
});

describe("cleanUp", () => {
    const path = (points) => ({ type: "path", points, color: "#111", size: 4, opacity: 100, zIndex: 1, rotation: 0 });
    const roughBox = (x, y) => [
        { x, y },
        { x: x + 50, y: y + 2 },
        { x: x + 100, y },
        { x: x + 101, y: y + 40 },
        { x: x + 100, y: y + 80 },
        { x: x + 50, y: y + 79 },
        { x, y: y + 80 },
        { x: x + 2, y: y + 40 },
        { x: x + 3, y: y + 6 },
    ];
    const line = (from, to) => Array.from({ length: 10 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / 9, y: from.y + ((to.y - from.y) * i) / 9 }));

    it("replaces a rough box with a clean shape where it was drawn", () => {
        const elements = { box: path(roughBox(0, 0)) };
        const result = executeOperation(elements, buildGroupIndex([{ ref: "obj_box", memberElementIds: ["box"] }]), { op: "cleanUp", refs: ["obj_box"] });
        const [shape] = Object.values(result.newElementsById);
        expect(shape).toMatchObject({ type: "shape", shapeType: "Rectangle", startX: 0, startY: 0, color: "#111" });
        expect(result.deletedIds).toEqual(["box"]);
    });

    it("turns a stroke between two boxes into a bound connector and removes its arrowhead", () => {
        const elements = {
            left: path(roughBox(0, 0)),
            right: path(roughBox(400, 0)),
            shaft: path(line({ x: 110, y: 40 }, { x: 390, y: 40 })),
            head: path(line({ x: 370, y: 25 }, { x: 390, y: 40 })),
        };
        const refs = Object.keys(elements).map((id) => ({ ref: `obj_${id}`, memberElementIds: [id] }));
        const result = executeOperation(elements, buildGroupIndex(refs), { op: "cleanUp", refs: refs.map((entry) => entry.ref) });
        const connector = Object.values(result.newElementsById).find((element) => element.type === "connector");
        expect(connector.startElementId).toBeTruthy();
        expect(connector.endElementId).toBeTruthy();
        expect(connector.startElementId).not.toBe(connector.endElementId);
        expect(connector.arrowEnd).toBe(true);
        expect(result.deletedIds).toEqual(expect.arrayContaining(["left", "right", "shaft", "head"]));
    });

    it("leaves a scribble alone and says so when there is nothing to clean", () => {
        const scribble = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: i % 2 === 0 ? 0 : 60 }));
        const result = executeOperation({ s: path(scribble) }, buildGroupIndex([{ ref: "obj_s", memberElementIds: ["s"] }]), {
            op: "cleanUp",
            refs: ["obj_s"],
        });
        expect(result.error).toBeTruthy();
    });

    it("reports refs with no strokes in them", () => {
        const shape = { type: "shape", shapeType: "Rectangle", startX: 0, startY: 0, endX: 10, endY: 10 };
        const result = executeOperation({ a: shape }, buildGroupIndex([{ ref: "obj_a", memberElementIds: ["a"] }]), { op: "cleanUp", refs: ["obj_a"] });
        expect(result.error).toContain("no hand-drawn strokes");
    });
});

describe("words, locks and fonts", () => {
    const index = (elements) => buildGroupIndex(objectsFor(elements));

    it("sets the words on a shape that holds its own text, and renames a frame", () => {
        const elements = { a: shape({ text: "Login" }), f: { type: "frame", name: "Old", startX: 0, startY: 0, endX: 10, endY: 10, color: "#000", zIndex: 0 } };
        expect(executeOperation(elements, index(elements), { op: "setText", ref: "a", text: "1 Login" }).updatedById.a.text).toBe("1 Login");
        expect(executeOperation(elements, index(elements), { op: "setText", ref: "f", text: "Backlog" }).updatedById.f.name).toBe("Backlog");
    });

    it("locks every element of its refs", () => {
        const elements = { a: shape(), b: shape() };
        const result = executeOperation(elements, index(elements), { op: "lock", refs: ["a", "b"] });
        expect(Object.values(result.updatedById).every((element) => element.locked)).toBe(true);
    });

    it("turns a named font into the fields text carries", () => {
        const elements = { t: { type: "text", x: 0, y: 0, width: 100, text: "hi", color: "#000", size: 16, opacity: 100, zIndex: 1, rotation: 0 } };
        const result = executeOperation(elements, index(elements), { op: "restyle", ref: "t", props: { font: "hand" } });
        expect(result.updatedById.t.fontFamily).toMatch(/Caveat/);
        expect(result.updatedById.t.fontSource).toMatchObject({ kind: "google" });
    });
});
