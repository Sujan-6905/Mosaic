import { describe, it, expect } from "vitest";
import { extractChunks, buildSearchIndex } from "../indexer.js";

describe("extractChunks", () => {
    it("finds words typed inside shapes, on connectors and on labelled sketches", () => {
        const chunks = extractChunks("", {
            box: { type: "shape", shapeType: "Rectangle", startX: 10, startY: 20, endX: 90, endY: 60, text: "Login", subtext: "OAuth" },
            arrow: { type: "connector", startX: 0, startY: 0, endX: 5, endY: 5, text: "on failure" },
            doodle: { type: "path", points: [{ x: 3, y: 4 }], label: "cloud" },
            blank: { type: "shape", startX: 0, startY: 0, endX: 1, endY: 1 },
        });
        expect(chunks).toEqual([
            { sourceType: "shape", elementId: "box", text: "Login\nOAuth", x: 10, y: 20 },
            { sourceType: "connector", elementId: "arrow", text: "on failure", x: 0, y: 0 },
            { sourceType: "sketch", elementId: "doodle", text: "cloud", x: null, y: null },
        ]);
    });

    it("includes the board title as its own chunk", () => {
        const chunks = extractChunks("Auth Flow Sketch", {});
        expect(chunks).toEqual([{ sourceType: "title", elementId: null, text: "Auth Flow Sketch", x: null, y: null }]);
    });

    it("omits a blank or missing title", () => {
        expect(extractChunks("", {})).toEqual([]);
        expect(extractChunks(undefined, {})).toEqual([]);
    });

    it("extracts text elements, sticky notes and frame names", () => {
        const elements = {
            t1: { type: "text", text: "login endpoint", x: 10, y: 20 },
            s1: { type: "sticky", text: "follow up with design", x: 30, y: 40 },
            f1: { type: "frame", name: "Backend", startX: 0, startY: 0 },
        };
        const chunks = extractChunks(null, elements);
        expect(chunks.map((c) => c.sourceType).sort()).toEqual(["frame", "sticky", "text"]);
        expect(chunks.find((c) => c.elementId === "t1").text).toBe("login endpoint");
    });

    it("skips shapes, connectors, paths and images entirely", () => {
        const elements = {
            shape1: { type: "shape", shapeType: "Rectangle" },
            conn1: { type: "connector", startElementId: "a", endElementId: "b" },
            path1: { type: "path", points: [{ x: 0, y: 0 }] },
            img1: { type: "image", src: "https://example.com/x.png" },
        };
        expect(extractChunks(null, elements)).toEqual([]);
    });

    it("skips a text/sticky element with no text content", () => {
        const elements = { t1: { type: "text", text: "" }, t2: { type: "text" } };
        expect(extractChunks(null, elements)).toEqual([]);
    });

    it("truncates a very long chunk to the max length", () => {
        const longText = "a".repeat(500);
        const chunks = extractChunks(null, { t1: { type: "text", text: longText } });
        expect(chunks[0].text.length).toBe(300);
    });
});

describe("buildSearchIndex", () => {
    it("attaches an embedding to every chunk", () => {
        const index = buildSearchIndex("My Board", { t1: { type: "text", text: "hello" } });
        expect(index).toHaveLength(2);
        index.forEach((chunk) => expect(Array.isArray(chunk.embedding)).toBe(true));
    });

    it("returns an empty array for a title-less, content-less board", () => {
        expect(buildSearchIndex("", {})).toEqual([]);
    });
});
