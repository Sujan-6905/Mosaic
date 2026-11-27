import { describe, it, expect } from "vitest";
import { buildCanonicalScene } from "../canonicalScene.js";
import { attachNearestLabels } from "../labelAttachment.js";

const build = (elements) => buildCanonicalScene(elements).objects;

describe("attachNearestLabels", () => {
    it("names an unlabeled shape after a text object close enough to be its caption", () => {
        const objects = build({
            box: {
                type: "shape",
                shapeType: "rectangle",
                startX: 0,
                startY: 40,
                endX: 100,
                endY: 100,
                color: "#000",
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
            caption: { type: "text", x: 0, y: 10, width: 100, text: "Login", color: "#000", size: 16, zIndex: 2, rotation: 0 },
        });
        attachNearestLabels(objects);
        const box = objects.find((o) => o.elementId === "box");
        expect(box.name).toBe("Login");
    });

    it("leaves a shape unnamed when the nearest text is outside the search radius", () => {
        const objects = build({
            box: {
                type: "shape",
                shapeType: "rectangle",
                startX: 0,
                startY: 1000,
                endX: 100,
                endY: 1060,
                color: "#000",
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
            caption: { type: "text", x: 0, y: 0, width: 100, text: "Far away", color: "#000", size: 16, zIndex: 2, rotation: 0 },
        });
        attachNearestLabels(objects);
        const box = objects.find((o) => o.elementId === "box");
        expect(box.name).toBeNull();
    });

    it("truncates a long caption rather than copying it verbatim", () => {
        // Long enough to be truncated, short enough that its box stays within the search radius.
        const longText = "a".repeat(100);
        const objects = build({
            box: {
                type: "shape",
                shapeType: "rectangle",
                startX: 0,
                startY: 40,
                endX: 100,
                endY: 100,
                color: "#000",
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
            caption: { type: "text", x: 0, y: 10, width: 100, text: longText, color: "#000", size: 16, zIndex: 2, rotation: 0 },
        });
        attachNearestLabels(objects);
        const box = objects.find((o) => o.elementId === "box");
        expect(box.name.length).toBeLessThan(longText.length);
        expect(box.name.endsWith("…")).toBe(true);
    });

    it("never renames a text or sticky object - those already name themselves", () => {
        const objects = build({
            note: { type: "sticky", x: 0, y: 0, width: 100, height: 100, text: "Note", color: "#000", fillColor: "#fef08a", size: 14, zIndex: 1, rotation: 0 },
            caption: { type: "text", x: 0, y: 120, width: 100, text: "Unrelated", color: "#000", size: 16, zIndex: 2, rotation: 0 },
        });
        attachNearestLabels(objects);
        const note = objects.find((o) => o.elementId === "note");
        expect(note.name).toBe("Note");
    });
});
