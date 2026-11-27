import { describe, it, expect } from "vitest";
import { mergeSketchParts, wholeSketchObjects } from "../sketchObjects.js";

const stroke = (label, sketchId, sketchTitle = "a cute dog") => ({ type: "path", label, sketchId, sketchTitle, points: [{ x: 0, y: 0 }] });
const object = (ref, name, minX) => ({
    ref,
    type: "path",
    name,
    memberRefs: [ref],
    memberElementIds: [ref],
    bounds: { minX, minY: 0, maxX: minX + 10, maxY: 10 },
    zIndex: 1,
});

describe("mergeSketchParts", () => {
    it("makes one object of the strokes of one part, in one sketch", () => {
        const elements = { a: stroke("legs", "s1"), b: stroke("legs", "s1"), c: stroke("head", "s1") };
        const merged = mergeSketchParts([object("a", "legs", 0), object("b", "legs", 50), object("c", "head", 100)], elements);
        expect(merged.map((part) => part.name)).toEqual(["legs", "head"]);
        expect(merged[0].memberElementIds).toEqual(["a", "b"]);
        expect(merged[0].bounds.maxX).toBe(60);
    });

    it("treats a part as locked when any of its strokes is, so an edit can't reach them", () => {
        const elements = { a: stroke("legs", "s1"), b: stroke("legs", "s1") };
        const [part] = mergeSketchParts([object("a", "legs", 0), { ...object("b", "legs", 50), locked: true }], elements);
        expect(part.locked).toBe(true);
    });

    it("keeps same-named parts of different sketches apart", () => {
        const elements = { a: stroke("legs", "s1"), b: stroke("legs", "s2") };
        expect(mergeSketchParts([object("a", "legs", 0), object("b", "legs", 50)], elements)).toHaveLength(2);
    });

    it("leaves everything that isn't a named stroke alone", () => {
        const elements = { a: { type: "shape" }, b: { type: "path", points: [] } };
        const objects = [object("a", "box", 0), object("b", null, 50)];
        expect(mergeSketchParts(objects, elements)).toEqual(objects);
    });
});

describe("wholeSketchObjects", () => {
    it("adds one object per sketch, named by its title and covering every part", () => {
        const elements = { a: stroke("head", "sketch-one"), b: stroke("tail", "sketch-one"), c: stroke("roof", "sketch-two", "a house") };
        const whole = wholeSketchObjects([object("a", "head", 0), object("b", "tail", 50), object("c", "roof", 100)], elements);
        expect(whole).toHaveLength(2);
        expect(whole[0]).toMatchObject({ type: "sketch", name: "a cute dog", memberElementIds: ["a", "b"], partRefs: ["a", "b"], wholeSketch: true });
        expect(whole[0].bounds).toEqual({ minX: 0, minY: 0, maxX: 60, maxY: 10 });
    });

    it("has nothing to add for strokes that aren't part of a sketch", () => {
        expect(wholeSketchObjects([object("a", "line", 0)], { a: { type: "path", points: [] } })).toEqual([]);
    });
});
