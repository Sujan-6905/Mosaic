import { describe, it, expect } from "vitest";
import "../layoutEngine.js";
import { buildDiagram } from "../../../../../../shared/canvas/diagramStyles/index.js";
import { findDiagramProblems } from "./diagramQuality.js";
import { randomDiagram } from "./diagramFixtures.js";

const SEEDS = Array.from({ length: 240 }, (_, i) => i + 1);
const FUZZ_TIMEOUT_MS = 60_000;
const STRUCTURE_FOR = { "top-down": "flowchart", "left-right": "pipeline" };
const DIRECTIONS = Object.keys(STRUCTURE_FOR);

const build = (graph, direction) => {
    let n = 0;
    const { elements } = buildDiagram({ model: graph, recipe: { structure: STRUCTURE_FOR[direction], look: "ink" }, generateElementId: () => `el-${n++}` });
    return Object.fromEntries(elements.map(({ elementId, element }) => [elementId, element]));
};

const tally = (direction) => {
    const byRule = {};
    const failingSeeds = new Set();
    SEEDS.forEach((seed) => {
        findDiagramProblems(build(randomDiagram(seed), direction)).forEach(({ rule }) => {
            byRule[rule] = (byRule[rule] || 0) + 1;
            failingSeeds.add(seed);
        });
    });
    return { byRule, failingSeeds: [...failingSeeds] };
};

describe("generated diagrams across random graphs", () => {
    DIRECTIONS.forEach((direction) => {
        it(
            `has no layout problems laid out ${direction}`,
            () => {
                const { byRule, failingSeeds } = tally(direction);
                expect({ byRule, failingSeeds: failingSeeds.slice(0, 10) }).toEqual({ byRule: {}, failingSeeds: [] });
            },
            FUZZ_TIMEOUT_MS,
        );
    });

    it(
        "routes every connector with only horizontal and vertical runs",
        () => {
            DIRECTIONS.forEach((direction) => {
                SEEDS.forEach((seed) => {
                    const elements = build(randomDiagram(seed), direction);
                    Object.values(elements)
                        .filter((element) => element.type === "connector" && element.startElementId !== element.endElementId && element.routing !== "elbow")
                        .forEach((connector) => {
                            const points = [
                                { x: connector.startX, y: connector.startY },
                                ...(connector.waypoints || []),
                                { x: connector.endX, y: connector.endY },
                            ];
                            // Sub-pixel skew from collinear simplification isn't visible; a real diagonal is.
                            const diagonal = points.slice(1).some((p, k) => Math.abs(p.x - points[k].x) > 1 && Math.abs(p.y - points[k].y) > 1);
                            expect({ seed, direction, diagonal }).toEqual({ seed, direction, diagonal: false });
                        });
                });
            });
        },
        FUZZ_TIMEOUT_MS,
    );

    it(
        "produces identical output for identical input",
        () => {
            SEEDS.slice(0, 40).forEach((seed) => {
                const graph = randomDiagram(seed);
                expect(build(graph, "top-down")).toEqual(build(graph, "top-down"));
            });
        },
        FUZZ_TIMEOUT_MS,
    );
});
