import { describe, it, expect } from "vitest";
import { updateCanvasSchema, MAX_ELEMENT_BYTES } from "../socketSchemas.js";

describe("updateCanvasSchema - path element", () => {
    const basePath = {
        type: "path",
        points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ],
        color: "#000000",
        size: 4,
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    };

    it("accepts a valid insert with a path element", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
            element: basePath,
        });
        expect(result.success).toBe(true);
    });

    it("rejects a points array over 10,000 entries", () => {
        const hugePath = { ...basePath, points: Array.from({ length: 10001 }, () => ({ x: 0, y: 0 })) };
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
            element: hugePath,
        });
        expect(result.success).toBe(false);
    });

    it("rejects an element whose serialized size exceeds the 50KB cap", () => {
        const oversized = { ...basePath, color: "#000000".repeat(MAX_ELEMENT_BYTES) };
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
            element: oversized,
        });
        expect(result.success).toBe(false);
    });

    it("accepts points with an optional per-point pressure", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
            element: {
                ...basePath,
                points: [
                    { x: 0, y: 0, pressure: 0.3 },
                    { x: 1, y: 1, pressure: 0.9 },
                ],
            },
        });
        expect(result.success).toBe(true);
    });

    it("accepts points with no pressure at all - old-format clients still validate", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
            element: basePath,
        });
        expect(result.success).toBe(true);
    });

    it("rejects a pressure value outside [0, 1]", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
            element: { ...basePath, points: [{ x: 0, y: 0, pressure: 1.5 }] },
        });
        expect(result.success).toBe(false);
    });
});

describe("updateCanvasSchema - shape and text elements", () => {
    it("accepts a valid shape element", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "update",
            elementId: "shape-1",
            element: {
                type: "shape",
                shapeType: "Rectangle",
                startX: 0,
                startY: 0,
                endX: 100,
                endY: 50,
                color: "#000",
                fillColor: null,
                size: 2,
                opacity: 100,
                zIndex: 1,
                rotation: 0,
            },
        });
        expect(result.success).toBe(true);
    });

    it("accepts a valid text element", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "text-1",
            element: { type: "text", x: 10, y: 20, width: 200, text: "hello", color: "#000", size: 16, zIndex: 1, rotation: 0 },
        });
        expect(result.success).toBe(true);
    });

    it("accepts a text element with rich formatting fields", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "text-2",
            element: {
                type: "text",
                x: 10,
                y: 20,
                width: 200,
                text: "hello",
                color: "#000",
                size: 16,
                fontFamily: "Georgia, serif",
                fontWeight: "bold",
                fontStyle: "italic",
                underline: true,
                strikethrough: false,
                align: "center",
                zIndex: 1,
                rotation: 0,
            },
        });
        expect(result.success).toBe(true);
    });

    it("rejects a text element with no width", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "text-3",
            element: { type: "text", x: 10, y: 20, text: "hello", color: "#000", size: 16, zIndex: 1, rotation: 0 },
        });
        expect(result.success).toBe(false);
    });

    it("rejects an element with an unrecognized type", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "bad-1",
            element: { type: "script", payload: "<img onerror=alert(1)>" },
        });
        expect(result.success).toBe(false);
    });
});

describe("updateCanvasSchema - sticky element", () => {
    const baseSticky = {
        type: "sticky",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        text: "note",
        color: "#000",
        fillColor: "#fef08a",
        size: 16,
        zIndex: 1,
        rotation: 0,
    };

    it("accepts a valid sticky element", () => {
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "s1", element: baseSticky }).success).toBe(true);
    });

    it("rejects a sticky element with no fillColor", () => {
        const { fillColor, ...withoutFill } = baseSticky;
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "s1", element: withoutFill }).success).toBe(false);
    });
});

describe("updateCanvasSchema - frame element", () => {
    it("accepts a valid frame element", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "f1",
            element: {
                type: "frame",
                startX: 0,
                startY: 0,
                endX: 500,
                endY: 500,
                name: "Frame 1",
                color: "#808080",
                zIndex: 0,
                rotation: 0,
            },
        });
        expect(result.success).toBe(true);
    });

    it("rejects a frame element with no name", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "f1",
            element: { type: "frame", startX: 0, startY: 0, endX: 500, endY: 500, color: "#808080", zIndex: 0, rotation: 0 },
        });
        expect(result.success).toBe(false);
    });
});

describe("updateCanvasSchema - connector element", () => {
    const baseConnector = {
        type: "connector",
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100,
        startElementId: null,
        endElementId: null,
        color: "#000",
        size: 2,
        opacity: 100,
        arrowStart: false,
        arrowEnd: true,
        zIndex: 1,
        rotation: 0,
    };

    it("accepts a valid unbound connector element", () => {
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "c1", element: baseConnector }).success).toBe(true);
    });

    it("accepts a connector bound to two elements", () => {
        const element = { ...baseConnector, startElementId: "elA", endElementId: "elB" };
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "c1", element }).success).toBe(true);
    });

    it("keeps a routed connector's waypoints", () => {
        const element = {
            ...baseConnector,
            waypoints: [
                { x: 0, y: 50 },
                { x: 100, y: 50 },
            ],
        };
        const result = updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "c1", element });
        expect(result.success).toBe(true);
        expect(result.data.element.waypoints).toEqual(element.waypoints);
    });

    it("rejects a waypoint that isn't a plain point", () => {
        const element = { ...baseConnector, waypoints: [{ x: 0, y: 50, extra: true }] };
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "c1", element }).success).toBe(false);
    });

    it("rejects a connector with no arrowEnd flag", () => {
        const { arrowEnd, ...withoutArrowEnd } = baseConnector;
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "c1", element: withoutArrowEnd }).success).toBe(false);
    });
});

describe("updateCanvasSchema - image element", () => {
    const baseImage = {
        type: "image",
        startX: 0,
        startY: 0,
        endX: 400,
        endY: 300,
        src: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME?.trim() || "demo"}/image/upload/v1/mosaic-boards/sample.jpg`,
        publicId: "mosaic-boards/sample",
        opacity: 100,
        zIndex: 1,
        rotation: 0,
    };

    it("accepts a valid image element", () => {
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "i1", element: baseImage }).success).toBe(true);
    });

    it("rejects an image element whose src isn't a URL", () => {
        const element = { ...baseImage, src: "not-a-url" };
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "i1", element }).success).toBe(false);
    });

    it.each([
        "http://example.com/a.png",
        "https://example.com/a.png",
        "https://res.cloudinary.com/demo/image/upload/v1/elsewhere/a.png",
        "https://res.cloudinary.com/demo/raw/upload/v1/mosaic-boards/a.png",
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
    ])("rejects an image loaded from %s", (src) => {
        expect(updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "i1", element: { ...baseImage, src } }).success).toBe(false);
    });
});

describe("updateCanvasSchema - operation rules", () => {
    it("rejects an insert with no element", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "insert",
            elementId: "1234-abcde",
        });
        expect(result.success).toBe(false);
    });

    it("accepts a delete with no element", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "delete",
            elementId: "1234-abcde",
        });
        expect(result.success).toBe(true);
    });

    it("rejects an operation outside the known enum", () => {
        const result = updateCanvasSchema.safeParse({
            shareId: "abc123",
            operation: "drop-table",
            elementId: "1234-abcde",
        });
        expect(result.success).toBe(false);
    });
});

describe("element numbers", () => {
    const text = { type: "text", x: 0, y: 0, width: 80, text: "a", color: "#000", size: 16, zIndex: 1, rotation: 0 };
    const accepts = (element) => updateCanvasSchema.safeParse({ shareId: "abc123", operation: "insert", elementId: "n1", element }).success;

    it("accepts positions anywhere a real board reaches", () => {
        expect(accepts({ ...text, x: -2_500_000, y: 9_000_000 })).toBe(true);
    });

    it.each([1e12, -1e12, Infinity, NaN])("refuses %s as a position", (x) => {
        expect(accepts({ ...text, x })).toBe(false);
    });
});
