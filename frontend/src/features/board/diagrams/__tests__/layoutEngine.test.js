import { describe, it, expect } from "vitest";
import { computeLayout, layoutGraph, LAYOUT_DIRECTIONS } from "../layoutEngine.js";

const chain = [
    { id: "a", label: "Start" },
    { id: "b", label: "Middle step" },
    { id: "c", label: "End" },
];
const chainEdges = [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
];

describe("computeLayout", () => {
    it("returns nothing for an empty graph", () => {
        expect(computeLayout([], [])).toEqual({});
    });

    it("places every node exactly once", () => {
        const positions = computeLayout(chain, chainEdges);
        expect(Object.keys(positions).sort()).toEqual(["a", "b", "c"]);
    });

    it("lays out top-down so rank order increases along y", () => {
        const positions = computeLayout(chain, chainEdges, LAYOUT_DIRECTIONS.TOP_DOWN);
        expect(positions.a.cy).toBeLessThan(positions.b.cy);
        expect(positions.b.cy).toBeLessThan(positions.c.cy);
    });

    it("lays out left-right so rank order increases along x instead", () => {
        const positions = computeLayout(chain, chainEdges, LAYOUT_DIRECTIONS.LEFT_RIGHT);
        expect(positions.a.cx).toBeLessThan(positions.b.cx);
        expect(positions.b.cx).toBeLessThan(positions.c.cx);
    });

    it("estimates node width from label length when no size is given", () => {
        const positions = computeLayout(
            [
                { id: "short", label: "Hi" },
                { id: "long", label: "A much, much longer label here" },
            ],
            [],
        );
        expect(positions.long.w).toBeGreaterThan(positions.short.w);
    });

    it("keeps a caller-provided node size instead of estimating it", () => {
        const positions = computeLayout([{ id: "a", label: "x", w: 400, h: 120 }], []);
        expect(positions.a).toMatchObject({ w: 400, h: 120 });
    });

    it("places the most-connected node at the radial center", () => {
        const hub = [
            { id: "center", label: "Hub" },
            { id: "leaf1", label: "Leaf 1" },
            { id: "leaf2", label: "Leaf 2" },
            { id: "leaf3", label: "Leaf 3" },
        ];
        const edges = [
            { from: "center", to: "leaf1" },
            { from: "center", to: "leaf2" },
            { from: "center", to: "leaf3" },
        ];
        const positions = computeLayout(hub, edges, LAYOUT_DIRECTIONS.RADIAL);
        expect(positions.center.cx).toBe(0);
        expect(positions.center.cy).toBe(0);
        ["leaf1", "leaf2", "leaf3"].forEach((id) => {
            const distance = Math.hypot(positions[id].cx, positions[id].cy);
            expect(distance).toBeGreaterThan(0);
        });
    });

    it("still places a node with no edges at all", () => {
        const positions = computeLayout(
            [
                { id: "a", label: "a" },
                { id: "isolated", label: "isolated" },
            ],
            [],
            LAYOUT_DIRECTIONS.RADIAL,
        );
        expect(positions.isolated).toBeDefined();
    });

    it("ignores an edge that references a node not in the graph", () => {
        const positions = computeLayout(chain, [...chainEdges, { from: "a", to: "ghost" }]);
        expect(Object.keys(positions).sort()).toEqual(["a", "b", "c"]);
    });
});

describe("computeLayout overlap guarantees", () => {
    const rectsOverlap = (a, b) => Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2;
    const anyOverlap = (positions) => {
        const list = Object.values(positions);
        return list.some((a, i) => list.slice(i + 1).some((b) => rectsOverlap(a, b)));
    };

    it("keeps each branch of a radial tree beside its parent, rooted where it's told", () => {
        const nodes = ["root", "a", "b", "a1", "a2", "b1", "b2"].map((id) => ({ id, label: id, root: id === "root" }));
        const edges = [
            ["root", "a"],
            ["root", "b"],
            ["a", "a1"],
            ["a", "a2"],
            ["b", "b1"],
            ["b", "b2"],
        ].map(([from, to]) => ({ from, to }));
        const positions = computeLayout(nodes, edges, LAYOUT_DIRECTIONS.RADIAL);
        expect(positions.root).toMatchObject({ cx: 0, cy: 0 });
        const angle = (id) => Math.atan2(positions[id].cy, positions[id].cx);
        const gap = (x, y) => Math.abs(Math.atan2(Math.sin(angle(x) - angle(y)), Math.cos(angle(x) - angle(y))));
        expect(gap("a1", "a")).toBeLessThan(gap("a1", "b"));
        expect(gap("b2", "b")).toBeLessThan(gap("b2", "a"));
    });

    it("keeps a wide radial ring free of overlapping nodes", () => {
        const nodes = [{ id: "hub", label: "Hub" }];
        const edges = [];
        for (let i = 0; i < 14; i += 1) {
            nodes.push({ id: `n${i}`, label: `Service number ${i} gateway` });
            edges.push({ from: "hub", to: `n${i}` });
        }
        expect(anyOverlap(computeLayout(nodes, edges, LAYOUT_DIRECTIONS.RADIAL))).toBe(false);
    });

    it("grows a node's height for a label that wraps onto several lines", () => {
        const positions = computeLayout(
            [
                { id: "short", label: "Hi" },
                { id: "long", label: "Validate the incoming webhook signature and reject replayed deliveries" },
            ],
            [],
        );
        expect(positions.long.h).toBeGreaterThan(positions.short.h);
    });

    it("keeps a layered layout with labelled edges free of overlap", () => {
        const nodes = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, label: `Step ${id} with a descriptive name` }));
        const edges = [
            ["a", "b"],
            ["a", "c"],
            ["b", "d"],
            ["c", "d"],
            ["d", "e"],
            ["d", "f"],
        ].map(([from, to]) => ({ from, to, label: "yes" }));
        expect(anyOverlap(computeLayout(nodes, edges, LAYOUT_DIRECTIONS.TOP_DOWN))).toBe(false);
    });
});

describe("layoutGraph routes", () => {
    const nodes = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: `Step ${id}` }));
    const edges = [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "a", to: "e" },
        { from: "d", to: "a", label: "retry" },
    ];

    [LAYOUT_DIRECTIONS.TOP_DOWN, LAYOUT_DIRECTIONS.LEFT_RIGHT].forEach((direction) => {
        it(`routes every edge with only horizontal and vertical runs (${direction})`, () => {
            const { positions, routes } = layoutGraph(nodes, edges, direction);
            routes.forEach((route, i) => {
                const from = positions[edges[i].from];
                const to = positions[edges[i].to];
                const points = [{ x: from.cx, y: from.cy }, ...route.waypoints, { x: to.cx, y: to.cy }];
                for (let k = 1; k < points.length; k += 1) {
                    const axisAligned = Math.abs(points[k].x - points[k - 1].x) < 0.01 || Math.abs(points[k].y - points[k - 1].y) < 0.01;
                    expect(axisAligned).toBe(true);
                }
            });
        });
    });

    it("reserves a slot for an edge label", () => {
        const { routes } = layoutGraph(nodes, edges, LAYOUT_DIRECTIONS.TOP_DOWN);
        expect(routes[4].label).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
        expect(routes[0].label).toBeNull();
    });

    it("keeps two parallel edges between the same nodes distinct", () => {
        const { routes } = layoutGraph(nodes.slice(0, 2), [
            { from: "a", to: "b" },
            { from: "a", to: "b", label: "again" },
        ]);
        expect(routes).toHaveLength(2);
        expect(routes.every(Boolean)).toBe(true);
    });

    it("sizes a diamond so its label fits inside the diamond, not just its box", () => {
        const { positions } = layoutGraph([{ id: "d", label: "Is the payment captured?", shape: "diamond" }], []);
        const { w, h, textWidth, textHeight } = positions.d;
        expect(textWidth / 2 / (w / 2) + textHeight / 2 / (h / 2)).toBeLessThanOrEqual(1);
    });
});
