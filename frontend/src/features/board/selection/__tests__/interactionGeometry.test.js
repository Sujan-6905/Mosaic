import { describe, it, expect } from "vitest";
import {
    elementPointToWorld,
    resizeElementFromHandle,
    resizeSelectionFromHandle,
    rotateElementAroundPivot,
    worldPointToElement,
} from "../../../../../../shared/canvas/geometry/elementGeometry.js";
import { getElementBounds } from "../../../../../../shared/canvas/geometry/bounds.js";
import {
    anchorToWorld,
    boundConnectorScope,
    connectorHead,
    elementOutlineWorld,
    getBoundConnectorUpdates,
    nearestOnPolyline,
    pointAlongPolyline,
    resolveConnectorPolyline,
    trimPolyline,
    withConnectorHeads,
} from "../../../../../../shared/canvas/elements/connectors.js";
import { getElementsInLasso } from "../lassoSelect.js";
import { dilateMask, enclosedRegionRings, floodFillEnclosed, traceMaskRings } from "../../tools/regionFill.js";
import { isClosedShape, shapeOutlinePoints, shapeToSvgPath, shapeTextBox } from "../../../../../../shared/canvas/geometry/shapeGeometry.js";
import {
    isEmbedFriendly,
    isSafeEmbedUrl,
    isSafeLink,
    normalizeLink,
    sanitizeIncomingElements,
    toEmbedUrl,
} from "../../../../../../shared/canvas/elements/links.js";

const rect = (x, y, w, h, extra = {}) => ({
    type: "shape",
    shapeType: "Rectangle",
    startX: x,
    startY: y,
    endX: x + w,
    endY: y + h,
    size: 2,
    rotation: 0,
    ...extra,
});

describe("shape outlines stay inside their box", () => {
    const shapeTypes = [
        "Rectangle",
        "Circle",
        "Ellipse",
        "Triangle",
        "Diamond",
        "Star",
        "Hexagon",
        "Pentagon",
        "Parallelogram",
        "Trapezoid",
        "Cylinder",
        "Document",
        "Cloud",
        "Callout",
        "BlockArrow",
        "Plus",
    ];

    it.each(shapeTypes)("%s", (shapeType) => {
        const shape = rect(100, 50, 200, 120, { shapeType });
        const points = shapeOutlinePoints(shape);
        expect(points.length).toBeGreaterThan(2);
        for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(99.9);
            expect(point.x).toBeLessThanOrEqual(300.1);
            expect(point.y).toBeGreaterThanOrEqual(49.9);
            expect(point.y).toBeLessThanOrEqual(170.1);
        }
    });

    it("a circle reaches all four sides of its box, so the selection fits it", () => {
        const xs = shapeOutlinePoints(rect(0, 0, 100, 100, { shapeType: "Circle" })).map((point) => point.x);
        expect(Math.min(...xs)).toBeCloseTo(0, 1);
        expect(Math.max(...xs)).toBeCloseTo(100, 1);
    });

    it("a star reaches the top and sides of its box", () => {
        const points = shapeOutlinePoints(rect(0, 0, 100, 100, { shapeType: "Star" }));
        expect(Math.min(...points.map((point) => point.y))).toBeCloseTo(0, 5);
        expect(Math.max(...points.map((point) => point.x))).toBeCloseTo(100, 5);
    });

    it("rounds a rectangle's corners without passing half its size", () => {
        expect(shapeToSvgPath(rect(0, 0, 100, 40, { cornerRadius: 500 }))).toContain("Q");
    });

    it("gives text less room inside a diamond than a rectangle", () => {
        expect(shapeTextBox(rect(0, 0, 100, 100, { shapeType: "Diamond" })).width).toBeLessThan(shapeTextBox(rect(0, 0, 100, 100)).width);
    });

    it("knows which shapes have an inside", () => {
        expect(isClosedShape(rect(0, 0, 10, 10))).toBe(true);
        expect(isClosedShape(rect(0, 0, 10, 10, { shapeType: "Line" }))).toBe(false);
    });
});

describe("rotation", () => {
    it("round-trips a point through an element's frame", () => {
        const shape = rect(0, 0, 100, 50, { rotation: 37 });
        const back = worldPointToElement(shape, elementPointToWorld(shape, { x: 10, y: 20 }));
        expect(back.x).toBeCloseTo(10);
        expect(back.y).toBeCloseTo(20);
    });

    it("turns a connector's points instead of giving it a rotation", () => {
        const connector = { type: "connector", startX: 0, startY: 0, endX: 100, endY: 0, waypoints: [{ x: 50, y: 0 }] };
        const turned = rotateElementAroundPivot(connector, 50, 0, 90);
        expect(turned.rotation).toBeUndefined();
        expect(turned.startX).toBeCloseTo(50);
        expect(turned.startY).toBeCloseTo(-50);
        expect(turned.waypoints[0].x).toBeCloseTo(50);
    });
});

describe("resizeElementFromHandle", () => {
    it("grows an unrotated box from a corner, with the opposite corner fixed", () => {
        const resized = resizeElementFromHandle(rect(0, 0, 100, 100), "se", { x: 200, y: 150 });
        expect(getElementBounds(resized)).toMatchObject({ minX: 0, minY: 0, maxX: 200, maxY: 150 });
    });

    it("keeps the opposite corner fixed on screen when the box is rotated", () => {
        const shape = rect(0, 0, 100, 100, { rotation: 45 });
        const fixedBefore = elementPointToWorld(shape, { x: 0, y: 0 });
        const resized = resizeElementFromHandle(shape, "se", elementPointToWorld(shape, { x: 150, y: 130 }));
        const bounds = getElementBounds(resized);
        const fixedAfter = elementPointToWorld(resized, { x: bounds.minX, y: bounds.minY });
        expect(fixedAfter.x).toBeCloseTo(fixedBefore.x, 5);
        expect(fixedAfter.y).toBeCloseTo(fixedBefore.y, 5);
        expect(bounds.maxX - bounds.minX).toBeCloseTo(150, 5);
        expect(bounds.maxY - bounds.minY).toBeCloseTo(130, 5);
    });

    it("locks proportions on request", () => {
        const bounds = getElementBounds(resizeElementFromHandle(rect(0, 0, 200, 100), "se", { x: 400, y: 120 }, { keepAspect: true }));
        expect((bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY)).toBeCloseTo(2);
    });

    it("grows from the middle on request", () => {
        const bounds = getElementBounds(resizeElementFromHandle(rect(0, 0, 100, 100), "e", { x: 150, y: 50 }, { fromCenter: true }));
        expect(bounds.minX).toBeCloseTo(-50);
        expect(bounds.maxX).toBeCloseTo(150);
    });

    it("never collapses or flips", () => {
        const bounds = getElementBounds(resizeElementFromHandle(rect(0, 0, 100, 100), "se", { x: -500, y: -500 }));
        expect(bounds.maxX).toBeGreaterThan(bounds.minX);
        expect(bounds.minX).toBe(0);
    });

    it("reflows text from an edge and scales it from a corner", () => {
        const text = { type: "text", x: 0, y: 0, width: 100, text: "hello", size: 20, autoWidth: true };
        const edge = resizeElementFromHandle(text, "e", { x: 200, y: 0 });
        expect(edge).toMatchObject({ width: 200, size: 20, autoWidth: false });
        expect(resizeElementFromHandle(text, "se", { x: 200, y: 26 }).size).toBeCloseTo(40);
    });
});

describe("resizeSelectionFromHandle", () => {
    it("scales everything together about the far corner", () => {
        const elements = { a: rect(0, 0, 100, 100), b: rect(100, 100, 100, 100) };
        const scaled = resizeSelectionFromHandle(elements, { minX: 0, minY: 0, maxX: 200, maxY: 200 }, "se", { x: 400, y: 400 });
        expect(getElementBounds(scaled.b)).toMatchObject({ minX: 200, minY: 200, maxX: 400, maxY: 400 });
    });

    it("moves a rotated member's middle without shearing it", () => {
        const elements = { a: rect(100, 100, 100, 100, { rotation: 30 }) };
        const scaled = resizeSelectionFromHandle(elements, { minX: 0, minY: 0, maxX: 200, maxY: 200 }, "se", { x: 400, y: 400 });
        const bounds = getElementBounds(scaled.a);
        expect(bounds.maxX - bounds.minX).toBeCloseTo(200);
        expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(300);
    });
});

describe("connector routes", () => {
    const circle = rect(100, 0, 100, 100, { shapeType: "Circle" });

    it("stops at a circle's real outline, not its box", () => {
        const elements = { c: circle };
        const connector = { type: "connector", startX: 0, startY: 0, endX: 150, endY: 50, startElementId: null, endElementId: "c" };
        const end = resolveConnectorPolyline(connector, elements).at(-1);
        expect(Math.hypot(end.x - 150, end.y - 50)).toBeCloseTo(50, 0);
    });

    it("stops at a rotated box's real edge", () => {
        const elements = { r: rect(100, 0, 100, 100, { rotation: 45 }) };
        const connector = { type: "connector", startX: 0, startY: 50, endX: 150, endY: 50, startElementId: null, endElementId: "r" };
        const end = resolveConnectorPolyline(connector, elements).at(-1);
        expect(end.x).toBeCloseTo(150 - Math.SQRT2 * 50, 0);
    });

    it("curves through its bends", () => {
        const connector = { type: "connector", routing: "curved", startX: 0, startY: 0, endX: 100, endY: 0, waypoints: [{ x: 50, y: 50 }] };
        const route = resolveConnectorPolyline(connector, {});
        expect(route.length).toBeGreaterThan(10);
        expect(route.some((point) => Math.abs(point.y - 50) < 0.5)).toBe(true);
    });

    it("runs an elbow route in straight runs only", () => {
        const connector = { type: "connector", routing: "elbow", startX: 0, startY: 0, endX: 100, endY: 80 };
        const route = resolveConnectorPolyline(connector, {});
        for (let i = 1; i < route.length; i += 1) {
            expect(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y).toBe(true);
        }
    });

    it("binds to another connector at a point along it", () => {
        const target = { type: "connector", startX: 0, startY: 0, endX: 100, endY: 0 };
        expect(anchorToWorld(target, { t: 0.25 }, {})).toEqual({ x: 25, y: 0 });
    });

    it("follows a connector bound to a connector, through two moves", () => {
        const elements = {
            box: rect(0, 0, 100, 100),
            first: { type: "connector", startX: 50, startY: 50, endX: 300, endY: 50, startElementId: "box", endElementId: null },
            second: { type: "connector", startX: 175, startY: 50, endX: 175, endY: 300, startElementId: "first", startAnchor: { t: 0.5 }, endElementId: null },
        };
        const moved = { ...elements, box: rect(0, 200, 100, 100) };
        const updates = getBoundConnectorUpdates(moved, ["box"]);
        expect(updates.first.startY).toBe(250);
        expect(updates.second).toBeDefined();
    });

    it("doesn't loop forever on two connectors bound to each other", () => {
        const elements = {
            a: { type: "connector", startX: 0, startY: 0, endX: 10, endY: 0, startElementId: "b", startAnchor: { t: 0.5 }, endElementId: null },
            b: { type: "connector", startX: 0, startY: 5, endX: 10, endY: 5, startElementId: "a", startAnchor: { t: 0.5 }, endElementId: null },
        };
        expect(() => getBoundConnectorUpdates(elements, ["a"])).not.toThrow();
        expect(() => resolveConnectorPolyline(elements.a, elements)).not.toThrow();
    });

    it("keeps a hand-made bend in place relative to its ends when an end moves", () => {
        const elements = {
            box: rect(0, 0, 100, 100),
            arrow: {
                type: "connector",
                routing: "straight",
                startX: 50,
                startY: 50,
                endX: 250,
                endY: 50,
                startElementId: "box",
                endElementId: null,
                waypoints: [{ x: 150, y: 150 }],
            },
        };
        const updates = getBoundConnectorUpdates({ ...elements, box: rect(0, 100, 100, 100) }, ["box"]);
        expect(updates.arrow.waypoints).toHaveLength(1);
    });

    it("collects only what a drag needs to recompute", () => {
        const elements = {
            a: rect(0, 0, 10, 10),
            b: rect(50, 0, 10, 10),
            far: rect(500, 500, 10, 10),
            link: { type: "connector", startElementId: "a", endElementId: "b" },
            other: { type: "connector", startElementId: "far", endElementId: null },
        };
        const { connectorIds, scope } = boundConnectorScope(elements, ["a"]);
        expect(connectorIds).toEqual(["link"]);
        expect(Object.keys(scope).sort()).toEqual(["a", "b", "link"]);
    });

    it("measures positions along a route", () => {
        const route = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
        ];
        expect(pointAlongPolyline(route, 0.5)).toEqual({ x: 50, y: 0 });
        expect(nearestOnPolyline(route, { x: 25, y: 40 }).fraction).toBeCloseTo(0.25);
        expect(trimPolyline(route, 10, 20)).toEqual([
            { x: 10, y: 0 },
            { x: 80, y: 0 },
        ]);
    });

    it("keeps legacy booleans in step with head choices", () => {
        expect(connectorHead({ arrowEnd: true }, "end")).toBe("triangle");
        expect(connectorHead({ endHead: "dot", arrowEnd: false }, "end")).toBe("dot");
        expect(withConnectorHeads({ startHead: "none", endHead: "bar" })).toMatchObject({ arrowStart: false, arrowEnd: true });
    });

    it("has no outline for a target with no solid edge", () => {
        expect(elementOutlineWorld({ type: "connector" })).toBeNull();
    });
});

describe("lasso", () => {
    const loop = [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
    ];

    it("takes what's mostly inside, and leaves what it only clips", () => {
        const elements = { inside: rect(50, 50, 40, 40), clipped: rect(190, 50, 200, 40), outside: rect(500, 500, 10, 10) };
        expect(getElementsInLasso(elements, Object.keys(elements), loop)).toEqual(["inside"]);
    });

    it("judges a stroke by its own points", () => {
        const stroke = { type: "path", points: Array.from({ length: 30 }, (_, i) => ({ x: 10 + i, y: 50 })) };
        expect(getElementsInLasso({ stroke }, ["stroke"], loop)).toEqual(["stroke"]);
    });
});

describe("enclosed region fill", () => {
    // A 40x40 picture with a closed square wall from 10 to 30.
    const picture = () => {
        const width = 40;
        const height = 40;
        const alpha = new Uint8Array(width * height);
        for (let i = 10; i <= 30; i += 1) {
            alpha[10 * width + i] = 255;
            alpha[30 * width + i] = 255;
            alpha[i * width + 10] = 255;
            alpha[i * width + 30] = 255;
        }
        return { alpha, width, height };
    };

    it("fills exactly what the wall encloses", () => {
        const { alpha, width, height } = picture();
        const filled = floodFillEnclosed(alpha, width, height, 20, 20);
        expect(filled.reduce((sum, value) => sum + value, 0)).toBe(19 * 19);
    });

    it("refuses when the fill would leak out to the edge", () => {
        const { alpha, width, height } = picture();
        expect(floodFillEnclosed(alpha, width, height, 2, 2)).toBeNull();
        alpha[10 * width + 20] = 0;
        expect(floodFillEnclosed(alpha, width, height, 20, 20)).toBeNull();
    });

    it("refuses a click on a wall", () => {
        const { alpha, width, height } = picture();
        expect(floodFillEnclosed(alpha, width, height, 10, 20)).toBeNull();
    });

    it("traces one ring round a solid area and another round a hole", () => {
        const width = 20;
        const mask = new Uint8Array(width * width);
        for (let y = 2; y < 18; y += 1) for (let x = 2; x < 18; x += 1) mask[y * width + x] = 1;
        expect(traceMaskRings(mask, width, width)).toHaveLength(1);
        for (let y = 8; y < 12; y += 1) for (let x = 8; x < 12; x += 1) mask[y * width + x] = 0;
        expect(traceMaskRings(mask, width, width)).toHaveLength(2);
    });

    it("grows the fill under its walls", () => {
        const width = 5;
        const mask = new Uint8Array(25);
        mask[12] = 1;
        expect(dilateMask(mask, width, width, 1).reduce((sum, value) => sum + value, 0)).toBe(5);
    });

    it("returns simplified rings for a region", () => {
        const { alpha, width, height } = picture();
        const rings = enclosedRegionRings(alpha, width, height, 20, 20);
        expect(rings).toHaveLength(1);
        expect(rings[0].length).toBeLessThan(10);
    });
});

describe("links and embeds", () => {
    it("allows web and mail links only", () => {
        expect(isSafeLink("https://a.com")).toBe(true);
        expect(isSafeLink("mailto:a@b.com")).toBe(true);
        expect(isSafeLink("javascript:alert(1)")).toBe(false);
        expect(isSafeLink("data:text/html,x")).toBe(false);
    });

    it("tidies what people type", () => {
        expect(normalizeLink("mosaic.app/x")).toBe("https://mosaic.app/x");
        expect(normalizeLink("not a link")).toBeNull();
        expect(normalizeLink("javascript:alert(1)")).toBeNull();
    });

    it("only frames https, and never the app itself", () => {
        expect(isSafeEmbedUrl("https://a.com")).toBe(true);
        expect(isSafeEmbedUrl("http://a.com")).toBe(false);
        expect(isSafeEmbedUrl("javascript:alert(1)")).toBe(false);
        expect(isSafeEmbedUrl("https://mosaic.app/x", ["https://mosaic.app"])).toBe(false);
    });

    it("rewrites sites to their embeddable address", () => {
        expect(toEmbedUrl("https://www.youtube.com/watch?v=abc")).toBe("https://www.youtube.com/embed/abc");
        expect(toEmbedUrl("https://youtu.be/abc")).toBe("https://www.youtube.com/embed/abc");
        expect(toEmbedUrl("https://vimeo.com/123")).toBe("https://player.vimeo.com/video/123");
        expect(toEmbedUrl("http://example.com/a")).toBe("https://example.com/a");
        expect(toEmbedUrl("mailto:a@b.com")).toBeNull();
    });

    it("knows which hosts are safe to load without asking", () => {
        expect(isEmbedFriendly("https://www.youtube.com/watch?v=a")).toBe(true);
        expect(isEmbedFriendly("https://example.com")).toBe(false);
    });

    it("cleans elements arriving from a clipboard or a file", () => {
        const incoming = [
            { type: "embed", url: "javascript:alert(1)" },
            { type: "embed", url: "https://ok.example" },
            { type: "shape", link: "javascript:alert(1)" },
            { type: "shape", link: "https://ok.example" },
            null,
        ];
        const clean = sanitizeIncomingElements(incoming);
        expect(clean).toHaveLength(3);
        expect(clean[1].link).toBeUndefined();
        expect(clean[2].link).toBe("https://ok.example");
    });
});
