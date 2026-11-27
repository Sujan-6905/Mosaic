import { describe, it, expect, beforeEach } from "vitest";
import { drawSceneStatic, drawDiffMarker } from "../staticSceneRenderer.js";

// Same recording-context pattern as backgroundRenderer.test.js: proves draw
// order/shape without needing jsdom's unimplemented canvas rendering.
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
    closePath() {
        this.calls.push(["closePath"]);
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
    ellipse() {
        this.calls.push(["ellipse"]);
    },
    rect(x, y, w, h) {
        this.calls.push(["rect", x, y, w, h]);
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
    strokeRect(x, y, w, h) {
        this.calls.push(["strokeRect", x, y, w, h]);
    },
    fillText(text, x, y) {
        this.calls.push(["fillText", text, x, y]);
    },
    measureText(text) {
        return { width: text.length * 6 };
    },
    setTransform(...args) {
        this.calls.push(["setTransform", ...args]);
    },
    translate(x, y) {
        this.calls.push(["translate", x, y]);
    },
    rotate(a) {
        this.calls.push(["rotate", a]);
    },
    setLineDash(d) {
        this.calls.push(["setLineDash", d]);
    },
    drawImage() {
        this.calls.push(["drawImage"]);
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
    set lineCap(v) {
        /* no-op */
    },
    set lineJoin(v) {
        /* no-op */
    },
    set globalAlpha(v) {
        /* no-op */
    },
    set textBaseline(v) {
        /* no-op */
    },
    set font(v) {
        /* no-op */
    },
});

const CAMERA = { x: 0, y: 0, zoom: 1 };
const VIEWPORT = [800, 600];

const rect = (overrides = {}) => ({
    type: "shape",
    shapeType: "Rectangle",
    startX: 0,
    startY: 0,
    endX: 10,
    endY: 10,
    color: "#000000",
    fillColor: null,
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
    ...overrides,
});

describe("drawSceneStatic", () => {
    let context;
    beforeEach(() => {
        context = createRecordingContext();
    });

    it("applies the camera transform before painting anything", () => {
        drawSceneStatic(context, {}, { type: "blank", colorToken: null }, CAMERA, ...VIEWPORT);
        expect(context.calls[0]).toEqual(["setTransform", 1, 0, 0, 1, -0, -0]);
    });

    it("draws every element in the scene", () => {
        const elements = { "el-1": rect({ zIndex: 1 }), "el-2": rect({ zIndex: 2, startX: 20, endX: 30 }) };
        drawSceneStatic(context, elements, { type: "blank", colorToken: null }, CAMERA, ...VIEWPORT);
        const rectCalls = context.calls.filter(([name]) => name === "moveTo");
        expect(rectCalls).toHaveLength(2);
    });

    it("paints elements in ascending zIndex order regardless of object key order", () => {
        const elements = {
            second: rect({ zIndex: 2, startX: 20, endX: 30 }),
            first: rect({ zIndex: 1, startX: 0, endX: 10 }),
        };
        drawSceneStatic(context, elements, { type: "blank", colorToken: null }, CAMERA, ...VIEWPORT);
        const rectCalls = context.calls.filter(([name]) => name === "moveTo");
        expect(rectCalls[0][1]).toBe(0); // first (zIndex 1) drawn before second
        expect(rectCalls[1][1]).toBe(20);
    });

    it("skips an unknown element type without throwing", () => {
        const elements = { "el-1": { type: "unknown-future-type", zIndex: 1 } };
        expect(() => drawSceneStatic(context, elements, { type: "blank", colorToken: null }, CAMERA, ...VIEWPORT)).not.toThrow();
    });
});

describe("drawDiffMarker", () => {
    let context;
    beforeEach(() => {
        context = createRecordingContext();
    });

    it("draws a solid strokeRect around the element's bounds by default", () => {
        drawDiffMarker(context, rect(), "#22c55e");
        expect(context.calls.some((c) => c[0] === "strokeRect")).toBe(true);
        expect(context.calls.some((c) => c[0] === "setLineDash")).toBe(false);
    });

    it("draws a dashed outline when dashed: true", () => {
        drawDiffMarker(context, rect(), "#ef4444", { dashed: true });
        expect(context.calls).toContainEqual(["setLineDash", [6, 4]]);
    });

    it("no-ops for an element with no resolvable bounds", () => {
        drawDiffMarker(context, { type: "unknown" }, "#000000");
        expect(context.calls).toEqual([]);
    });
});
