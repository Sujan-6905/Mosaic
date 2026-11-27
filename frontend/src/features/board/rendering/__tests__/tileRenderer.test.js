import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTileRenderer, findChangedElements, TILE_PX } from "../tileRenderer.js";

const fakeCanvas = () => {
    const context = { setTransform: vi.fn(), clearRect: vi.fn() };
    return { getContext: () => context };
};

const compositeContext = () => ({ setTransform: vi.fn(), drawImage: vi.fn() });

const camera = { x: 0, y: 0, zoom: 1 };
const VIEW = 400;

const setup = (elementsInRect = () => [["a", { zIndex: 1 }]]) => {
    let time = 0;
    const paintElements = vi.fn();
    const collectElements = vi.fn(elementsInRect);
    const renderer = createTileRenderer({ collectElements, paintElements, createCanvas: fakeCanvas, now: () => time });
    return {
        renderer,
        paintElements,
        collectElements,
        advance: (ms) => {
            time += ms;
        },
    };
};

const settle = ({ renderer, advance }, target = camera) => {
    renderer.composite(compositeContext(), target, 1, VIEW, VIEW);
    advance(1000);
    let finished = false;
    for (let i = 0; i < 40 && !finished; i++) finished = renderer.composite(compositeContext(), target, 1, VIEW, VIEW);
    return finished;
};

describe("createTileRenderer", () => {
    it("draws each tile once and composites it without drawing it again", () => {
        const harness = setup();
        expect(settle(harness)).toBe(true);
        harness.paintElements.mockClear();

        const context = compositeContext();
        expect(harness.renderer.composite(context, camera, 1, VIEW, VIEW)).toBe(true);
        expect(harness.paintElements).not.toHaveBeenCalled();
        expect(context.drawImage).toHaveBeenCalled();
    });

    it("places tiles on whole device pixels at a fractional camera position", () => {
        const harness = setup();
        const moved = { x: 10.4, y: 0.6, zoom: 1 };
        settle(harness, moved);
        const context = compositeContext();
        harness.renderer.composite(context, moved, 1, VIEW, VIEW);
        const [, left, top] = context.drawImage.mock.calls[0];
        expect(Number.isInteger(left)).toBe(true);
        expect(Number.isInteger(top)).toBe(true);
    });

    it("allocates nothing for a tile with no elements", () => {
        const harness = setup(() => []);
        settle(harness);
        const context = compositeContext();
        harness.renderer.composite(context, camera, 1, VIEW, VIEW);
        expect(context.drawImage).not.toHaveBeenCalled();
    });

    it("redraws only the tiles an edit touched", () => {
        const harness = setup();
        settle(harness);
        harness.paintElements.mockClear();

        harness.renderer.invalidateBounds({ minX: 100, minY: 100, maxX: 110, maxY: 110 });
        harness.renderer.composite(compositeContext(), camera, 1, VIEW, VIEW);
        expect(harness.paintElements).toHaveBeenCalledTimes(1);
    });

    it("includes elements just past a tile's edge, so strokes aren't cut off", () => {
        const harness = setup();
        settle(harness);
        const rect = harness.collectElements.mock.calls[0][0];
        expect(rect.minX).toBeLessThan(0);
        expect(rect.maxX).toBeGreaterThan(TILE_PX);
    });

    it("caps how many elements one frame draws, then keeps asking for frames", () => {
        const many = Array.from({ length: 400 }, (_, i) => [`e${i}`, { zIndex: i }]);
        const harness = setup(() => many);
        const large = 2000;
        harness.advance(1000);
        harness.renderer.composite(compositeContext(), camera, 1, large, large);
        harness.advance(1000);
        const finished = harness.renderer.composite(compositeContext(), camera, 1, large, large);
        expect(finished).toBe(false);
        expect(harness.paintElements.mock.calls.length).toBeLessThan(16);
    });

    it("stretches the current tiles while a zoom moves, and only then draws a sharp level", () => {
        const harness = setup();
        settle(harness);
        harness.paintElements.mockClear();

        const zoomed = { x: 0, y: 0, zoom: 1.2 };
        const moving = compositeContext();
        expect(harness.renderer.composite(moving, zoomed, 1, VIEW, VIEW)).toBe(false);
        expect(harness.paintElements).not.toHaveBeenCalled();
        const [, , , width] = moving.drawImage.mock.calls[0];
        expect(width).toBe(Math.ceil(TILE_PX * 1.2));

        harness.advance(1000);
        harness.renderer.composite(compositeContext(), zoomed, 1, VIEW, VIEW);
        expect(harness.paintElements).toHaveBeenCalled();
    });

    it("starts a new level when a zoom has stretched tiles too far", () => {
        const harness = setup();
        settle(harness);
        harness.paintElements.mockClear();
        harness.renderer.composite(compositeContext(), { x: 0, y: 0, zoom: 2.5 }, 1, VIEW, VIEW);
        expect(harness.paintElements).toHaveBeenCalled();
    });

    it("adds a top element to a finished tile without redrawing it", () => {
        const harness = setup();
        settle(harness);
        harness.paintElements.mockClear();
        harness.collectElements.mockClear();

        const entry = ["new", { zIndex: 5 }];
        harness.renderer.addToTop(entry, { minX: 200, minY: 200, maxX: 210, maxY: 210 });
        expect(harness.paintElements).toHaveBeenCalledTimes(1);
        expect(harness.collectElements).not.toHaveBeenCalled();
    });

    it("redraws a tile when a new element belongs under what's already there", () => {
        const harness = setup(() => [["top", { zIndex: 10 }]]);
        settle(harness);
        harness.paintElements.mockClear();

        harness.renderer.addToTop(["under", { zIndex: 1 }], { minX: 10, minY: 10, maxX: 20, maxY: 20 });
        expect(harness.paintElements).not.toHaveBeenCalled();
        expect(harness.renderer.composite(compositeContext(), camera, 1, VIEW, VIEW)).toBe(true);
        expect(harness.paintElements).toHaveBeenCalled();
    });

    it("redraws everything after invalidateAll, as a theme change needs", () => {
        const harness = setup();
        settle(harness);
        harness.paintElements.mockClear();
        harness.renderer.invalidateAll();
        harness.renderer.composite(compositeContext(), camera, 1, VIEW, VIEW);
        expect(harness.paintElements).toHaveBeenCalled();
    });

    it("stands in with another level's tiles while a level fills in", () => {
        const many = Array.from({ length: 700 }, (_, i) => [`e${i}`, { zIndex: i }]);
        const harness = setup(() => many);
        settle(harness);
        harness.advance(1000);
        const zoomedOut = { x: 0, y: 0, zoom: 0.3 };
        const context = compositeContext();
        harness.renderer.composite(context, zoomedOut, 1, VIEW, VIEW);
        expect(context.drawImage).toHaveBeenCalled();
    });
});

describe("findChangedElements", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const edited = { id: "a2" };

    it("reports both versions of an edited element", () => {
        expect(findChangedElements({ a }, { a: edited }, new Map())).toEqual([a, edited]);
    });

    it("reports an added element and a removed one", () => {
        expect(findChangedElements({ a }, { b }, new Map())).toEqual([b, a]);
    });

    it("skips an unchanged element", () => {
        expect(findChangedElements({ a }, { a }, new Map())).toEqual([]);
    });

    it("skips an element already drawn onto its tiles", () => {
        expect(findChangedElements({}, { b }, new Map([["b", b]]))).toEqual([]);
    });

    it("still reports a removal when nothing was drawn on top", () => {
        expect(findChangedElements({ a }, {}, new Map())).toEqual([a]);
    });

    it("reports an element drawn on top and deleted before any snapshot held it", () => {
        expect(findChangedElements({}, {}, new Map([["b", b]]))).toEqual([b]);
    });

    it("reports the old position of an element drawn on top and then moved", () => {
        expect(findChangedElements({}, { b: edited }, new Map([["b", b]]))).toEqual([b, edited]);
    });

    it("looks only at the ids it's told changed", () => {
        expect(findChangedElements({ a, b }, { a: edited, b: edited }, new Map(), new Set(["a"]))).toEqual([a, edited]);
    });

    it("finds a removal among known ids", () => {
        expect(findChangedElements({ a }, {}, new Map(), new Set(["a"]))).toEqual([a]);
    });
});
