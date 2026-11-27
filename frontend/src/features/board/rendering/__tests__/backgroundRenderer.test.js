import { describe, it, expect, beforeEach } from "vitest";
import { paintBackground, BACKGROUND_TYPES, SOLID_BACKGROUND_TOKENS } from "../backgroundRenderer.js";

// Records calls instead of drawing, since jsdom has no canvas rendering.
const createRecordingContext = () => ({
    calls: [],
    save() {
        this.calls.push(["save"]);
    },
    restore() {
        this.calls.push(["restore"]);
    },
    beginPath() {
        this.calls.push(["beginPath"]);
    },
    moveTo(x, y) {
        this.calls.push(["moveTo", x, y]);
    },
    lineTo(x, y) {
        this.calls.push(["lineTo", x, y]);
    },
    arc(x, y, r) {
        this.calls.push(["arc", x, y, r]);
    },
    fill() {
        this.calls.push(["fill"]);
    },
    stroke() {
        this.calls.push(["stroke"]);
    },
    fillRect(x, y, w, h) {
        this.calls.push(["fillRect", x, y, w, h]);
    },
    set fillStyle(v) {
        this.calls.push(["fillStyle", v]);
    },
    set strokeStyle(v) {
        this.calls.push(["strokeStyle", v]);
    },
    set lineWidth(v) {
        this.calls.push(["lineWidth", v]);
    },
});

const CAMERA = { x: 0, y: 0, zoom: 1 };
const VIEWPORT = [800, 600];

describe("paintBackground", () => {
    let context;
    beforeEach(() => {
        context = createRecordingContext();
    });

    it("makes no draw calls for a blank background", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, { type: "blank", colorToken: null });
        expect(context.calls).toEqual([]);
    });

    it("makes no draw calls when config is missing (defaults to blank)", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, null);
        expect(context.calls).toEqual([]);
    });

    it("fills exactly the visible world rect once for a solid background", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, { type: "solid", colorToken: "bg-sunken" });
        const fillRectCalls = context.calls.filter(([name]) => name === "fillRect");
        expect(fillRectCalls).toHaveLength(1);
        expect(fillRectCalls[0]).toEqual(["fillRect", 0, 0, 800, 600]);
    });

    it("draws a bounded number of dots covering the visible viewport", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, { type: "dot", colorToken: null });
        const arcCalls = context.calls.filter(([name]) => name === "arc");
        // ~25x18 grid cells at GRID_SIZE=32 over an 800x600 viewport, plus
        // one row/column of slack for partial cells at the edges.
        expect(arcCalls.length).toBeGreaterThan(300);
        expect(arcCalls.length).toBeLessThan(900);
        expect(context.calls.filter(([name]) => name === "fill")).toHaveLength(1);
    });

    it("draws both horizontal and vertical line families for a square grid", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, { type: "square", colorToken: null });
        const lineSegments = context.calls.filter(([name]) => name === "moveTo").length;
        // Roughly (800/32) vertical + (600/32) horizontal lines.
        expect(lineSegments).toBeGreaterThan(30);
        expect(lineSegments).toBeLessThan(60);
        expect(context.calls.filter(([name]) => name === "stroke")).toHaveLength(1);
    });

    it("draws only one line family for a lined background", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, { type: "lined", colorToken: null });
        const squareSegments = (() => {
            const c = createRecordingContext();
            paintBackground(c, CAMERA, ...VIEWPORT, { type: "square", colorToken: null });
            return c.calls.filter(([name]) => name === "moveTo").length;
        })();
        const linedSegments = context.calls.filter(([name]) => name === "moveTo").length;
        expect(linedSegments).toBeLessThan(squareSegments);
        expect(linedSegments).toBeGreaterThan(10);
    });

    it("draws three line families for an isometric grid", () => {
        paintBackground(context, CAMERA, ...VIEWPORT, { type: "isometric", colorToken: null });
        const squareSegments = (() => {
            const c = createRecordingContext();
            paintBackground(c, CAMERA, ...VIEWPORT, { type: "square", colorToken: null });
            return c.calls.filter(([name]) => name === "moveTo").length;
        })();
        const isoSegments = context.calls.filter(([name]) => name === "moveTo").length;
        expect(isoSegments).toBeGreaterThan(squareSegments);
    });

    it("skips grid/dot patterns entirely once screen spacing collapses below the legibility floor", () => {
        const zoomedOut = { x: 0, y: 0, zoom: 0.01 };
        paintBackground(context, zoomedOut, ...VIEWPORT, { type: "square", colorToken: null });
        expect(context.calls).toEqual([]);
    });

    it("still fills a solid background at extreme zoom-out (unaffected by the grid legibility floor)", () => {
        const zoomedOut = { x: 0, y: 0, zoom: 0.01 };
        paintBackground(context, zoomedOut, ...VIEWPORT, { type: "solid", colorToken: null });
        expect(context.calls.some(([name]) => name === "fillRect")).toBe(true);
    });

    it("exposes every background type and the solid-only token palette", () => {
        expect(BACKGROUND_TYPES).toContain("isometric");
        expect(SOLID_BACKGROUND_TOKENS.length).toBeGreaterThan(0);
    });
});
