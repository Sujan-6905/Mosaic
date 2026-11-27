import { describe, it, expect } from "vitest";
import { resolveExportScope, listFramePages, buildSvgDocument } from "../sceneExport.js";

const rectangle = (overrides = {}) => ({
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

describe("resolveExportScope", () => {
    const elements = {
        "el-1": rectangle({ zIndex: 1 }),
        "el-2": rectangle({ zIndex: 2, startX: 100, endX: 110 }),
        "frame-1": { type: "frame", startX: 90, startY: -10, endX: 130, endY: 30, name: "F1", zIndex: 0 },
    };

    it("returns every element and the full union bounds for scope 'board'", () => {
        const { elements: scoped, bounds } = resolveExportScope(elements, "board");
        expect(Object.keys(scoped)).toHaveLength(3);
        expect(bounds.minX).toBe(0);
        expect(bounds.maxX).toBe(130);
    });

    it("returns only the selected elements for scope 'selection'", () => {
        const { elements: scoped, bounds } = resolveExportScope(elements, "selection", { selectionIds: ["el-1"] });
        expect(Object.keys(scoped)).toEqual(["el-1"]);
        expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    });

    it("returns the frame plus its member elements for scope 'frame'", () => {
        const withMember = { ...elements, "el-2": { ...elements["el-2"], frameId: "frame-1" } };
        const { elements: scoped, bounds } = resolveExportScope(withMember, "frame", { frameId: "frame-1" });
        expect(Object.keys(scoped).sort()).toEqual(["el-2", "frame-1"]);
        expect(bounds).toEqual({ minX: 90, minY: -10, maxX: 130, maxY: 30 });
    });
});

describe("listFramePages", () => {
    it("returns one page per frame, each scoped to its own members", () => {
        const elements = {
            "frame-1": { type: "frame", startX: 0, startY: 0, endX: 50, endY: 50, name: "Page 1", zIndex: 0 },
            "frame-2": { type: "frame", startX: 100, startY: 0, endX: 150, endY: 50, name: "Page 2", zIndex: 0 },
            "el-1": { ...rectangle(), frameId: "frame-1" },
        };
        const pages = listFramePages(elements);
        expect(pages.map((p) => p.name)).toEqual(["Page 1", "Page 2"]);
        expect(Object.keys(pages[0].elements).sort()).toEqual(["el-1", "frame-1"]);
        expect(Object.keys(pages[1].elements)).toEqual(["frame-2"]);
    });
});

describe("buildSvgDocument", () => {
    it("emits a real <rect> for a rectangle shape, not a rasterized image", () => {
        const elements = { "el-1": rectangle() };
        const svg = buildSvgDocument(elements, { type: "blank", colorToken: null }, { minX: 0, minY: 0, maxX: 10, maxY: 10 });
        expect(svg).toContain("<svg");
        expect(svg).toContain("<rect");
        expect(svg).not.toContain("<image");
    });

    it("emits a <text> element with wrapped <tspan> lines for a text element", () => {
        const elements = { "el-1": { type: "text", x: 0, y: 0, width: 100, text: "hello", color: "#000000", size: 16, zIndex: 1, rotation: 0 } };
        const svg = buildSvgDocument(elements, { type: "blank", colorToken: null }, { minX: 0, minY: 0, maxX: 100, maxY: 40 });
        expect(svg).toContain("<text");
        expect(svg).toContain("<tspan");
        expect(svg).toContain("hello");
    });

    it('wraps a rotated element in a <g transform="rotate(...)">', () => {
        const elements = { "el-1": rectangle({ rotation: 45 }) };
        const svg = buildSvgDocument(elements, { type: "blank", colorToken: null }, { minX: 0, minY: 0, maxX: 10, maxY: 10 });
        expect(svg).toMatch(/<g transform="rotate\(45 5 5\)">/);
    });

    it("omits the background rect when transparent is requested", () => {
        const elements = { "el-1": rectangle() };
        const opaque = buildSvgDocument(elements, { type: "blank", colorToken: null }, { minX: 0, minY: 0, maxX: 10, maxY: 10 });
        const transparent = buildSvgDocument(elements, { type: "blank", colorToken: null }, { minX: 0, minY: 0, maxX: 10, maxY: 10 }, { transparent: true });
        expect(opaque).toContain('<rect x="-40" y="-40"');
        expect(transparent).not.toContain('<rect x="-40" y="-40"');
    });
});

describe("buildSvgDocument text and connectors", () => {
    const blank = { type: "blank", colorToken: null };

    it("centres a centre-aligned text element on its box", () => {
        const lineX = (align) => {
            const elements = { t: { type: "text", x: 0, y: 0, width: 100, text: "hi", align, color: "#000000", size: 16, zIndex: 1, rotation: 0 } };
            return Number(/<tspan x="([\d.]+)"/.exec(buildSvgDocument(elements, blank, { minX: 0, minY: 0, maxX: 100, maxY: 40 }))[1]);
        };
        expect(lineX("left")).toBe(0);
        expect(lineX("center")).toBeCloseTo(lineX("right") / 2);
        expect(lineX("center")).toBeGreaterThan(0);
    });

    it("draws a routed connector through its bends with an arrowhead on the last segment", () => {
        const elements = {
            c: {
                type: "connector",
                startX: 0,
                startY: 0,
                endX: 100,
                endY: 100,
                startElementId: null,
                endElementId: null,
                waypoints: [
                    { x: 0, y: 50 },
                    { x: 100, y: 50 },
                ],
                color: "#000000",
                size: 2,
                opacity: 100,
                arrowStart: false,
                arrowEnd: true,
                zIndex: 1,
                rotation: 0,
            },
        };
        const svg = buildSvgDocument(elements, blank, { minX: 0, minY: 0, maxX: 100, maxY: 100 });
        expect(svg).toMatch(/<polyline points="0,0 0,50 100,50 100,\d+/);
        expect(svg).toMatch(/<polygon points="100,100 /);
    });

    it("emits a diamond as a four-point path", () => {
        const elements = { d: rectangle({ shapeType: "Diamond", endX: 40, endY: 20 }) };
        expect(buildSvgDocument(elements, blank, { minX: 0, minY: 0, maxX: 40, maxY: 20 })).toContain('d="M20 0 L40 10 L20 20 L0 10 Z"');
    });
});
