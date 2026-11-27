import { describe, it, expect } from "vitest";
import { createSpatialIndex } from "../spatialIndex.js";
import { getElementBounds } from "../../../../../../shared/canvas/geometry/bounds.js";

const rect = (id, x, y, w = 10, h = 10) => [id, { type: "shape", shapeType: "rectangle", startX: x, startY: y, endX: x + w, endY: y + h }];

// Every query must match a naive scan of which bounds intersect the rect.
const naiveQueryRect = (elementsMap, rect) =>
    new Set(
        Object.entries(elementsMap)
            .filter(([, element]) => {
                const bounds = getElementBounds(element);
                if (!bounds) return false;
                return !(bounds.maxX < rect.minX || bounds.minX > rect.maxX || bounds.maxY < rect.minY || bounds.minY > rect.maxY);
            })
            .map(([id]) => id),
    );

describe("createSpatialIndex", () => {
    it("insert then queryRect finds the element", () => {
        const index = createSpatialIndex();
        const [id, element] = rect("a", 0, 0);
        index.insert(id, element);
        expect(index.queryRect({ minX: -5, minY: -5, maxX: 5, maxY: 5 })).toEqual(["a"]);
    });

    it("update moves a query hit from the old position to the new one", () => {
        const index = createSpatialIndex();
        const [id] = rect("a", 0, 0);
        index.insert(id, rect("a", 0, 0)[1]);
        expect(index.queryRect({ minX: -5, minY: -5, maxX: 5, maxY: 5 })).toEqual(["a"]);

        index.update(id, rect("a", 1000, 1000)[1]);
        expect(index.queryRect({ minX: -5, minY: -5, maxX: 5, maxY: 5 })).toEqual([]);
        expect(index.queryRect({ minX: 995, minY: 995, maxX: 1015, maxY: 1015 })).toEqual(["a"]);
    });

    it("remove eliminates all query hits", () => {
        const index = createSpatialIndex();
        const [id, element] = rect("a", 0, 0);
        index.insert(id, element);
        index.remove(id);
        expect(index.queryRect({ minX: -100, minY: -100, maxX: 100, maxY: 100 })).toEqual([]);
    });

    it("queryRect returns overlapping and edge-touching elements, excludes disjoint ones", () => {
        const index = createSpatialIndex();
        index.insert(...rect("overlap", 5, 5));
        index.insert(...rect("touching", 10, 0)); // starts exactly at query's maxX
        index.insert(...rect("disjoint", 1000, 1000));
        const hits = new Set(index.queryRect({ minX: 0, minY: 0, maxX: 10, maxY: 10 }));
        expect(hits.has("overlap")).toBe(true);
        expect(hits.has("touching")).toBe(true);
        expect(hits.has("disjoint")).toBe(false);
    });

    it("queryPoint finds elements within tolerance of a point", () => {
        const index = createSpatialIndex();
        index.insert(...rect("a", 0, 0));
        expect(index.queryPoint(-3, -3, 2)).toEqual([]);
        expect(index.queryPoint(-1, -1, 2)).toEqual(["a"]);
    });

    it("skips elements with degenerate (null) bounds - e.g. a 0-1-point path", () => {
        const index = createSpatialIndex();
        index.insert("stub", { type: "path", points: [] });
        expect(index.queryRect({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 })).toEqual([]);
    });

    it("load bulk-populates from a snapshot and clear empties it", () => {
        const index = createSpatialIndex();
        index.load({ a: rect("a", 0, 0)[1], b: rect("b", 100, 100)[1] });
        expect(new Set(index.queryRect({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 }))).toEqual(new Set(["a", "b"]));
        index.clear();
        expect(index.queryRect({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 })).toEqual([]);
    });

    it("getFullExtent returns the union bounds, or null when empty", () => {
        const index = createSpatialIndex();
        expect(index.getFullExtent()).toBeNull();
        index.insert(...rect("a", 0, 0, 10, 10));
        index.insert(...rect("b", 90, 90, 10, 10));
        expect(index.getFullExtent()).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    });

    it("stays correct through a mixed sequence of mutations, verified against a naive linear scan", () => {
        const index = createSpatialIndex();
        const reference = {};
        // Simple seeded PRNG so the test is deterministic.
        let seed = 42;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };

        for (let i = 0; i < 200; i++) {
            const id = `el-${i % 50}`;
            const op = rand();
            if (op < 0.6) {
                const element = rect(id, Math.floor(rand() * 1000), Math.floor(rand() * 1000), 5 + rand() * 20, 5 + rand() * 20)[1];
                if (reference[id]) {
                    index.update(id, element);
                } else {
                    index.insert(id, element);
                }
                reference[id] = element;
            } else if (reference[id]) {
                index.remove(id);
                delete reference[id];
            }
        }

        // A handful of query rects at various scales, each checked against
        // the naive reference implementation.
        const queryRects = [
            { minX: 0, minY: 0, maxX: 100, maxY: 100 },
            { minX: 400, minY: 400, maxX: 600, maxY: 600 },
            { minX: -50, minY: -50, maxX: 1050, maxY: 1050 },
            { minX: 999, minY: 999, maxX: 1000, maxY: 1000 },
        ];
        for (const queryRect of queryRects) {
            const indexed = new Set(index.queryRect(queryRect));
            const naive = naiveQueryRect(reference, queryRect);
            expect(indexed).toEqual(naive);
        }
    });
});
