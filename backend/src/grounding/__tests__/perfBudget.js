// Per-stage grounding budgets with a synthetic board generator and a harness that times the
// same stage functions buildGroundedScene runs.
import { summarizeFrameTimes } from "../../../../frontend/src/features/board/rendering/perfHarness.js";
import { buildCanonicalScene } from "../canonicalScene.js";
import { buildGroupedObjects } from "../objectGrouping.js";
import { buildRelationGraph } from "../relationGraph.js";
import { attachNearestLabels } from "../labelAttachment.js";
import { nameObjects } from "../naming.js";
import { serializeSceneContext } from "../contextSerializer.js";
import { resolveReference } from "../referenceResolver.js";

const SHAPE_TYPES = ["rectangle", "circle", "line", "triangle"];
const STRESS_CANVAS_SIZE = 20000;

// Scattered small shapes: cheap to generate, real geometry.
export const generateStressElements = (count) => {
    const elements = {};
    for (let i = 0; i < count; i++) {
        const startX = Math.random() * STRESS_CANVAS_SIZE;
        const startY = Math.random() * STRESS_CANVAS_SIZE;
        elements[`stress-${i}`] = {
            type: "shape",
            shapeType: SHAPE_TYPES[i % SHAPE_TYPES.length],
            startX,
            startY,
            endX: startX + 10 + Math.random() * 30,
            endY: startY + 10 + Math.random() * 30,
            color: "#000000",
            size: 1,
            opacity: 100,
            zIndex: i + 1,
            rotation: 0,
        };
    }
    return elements;
};

// Unscoped budgets with headroom for a noisy CI runner. Relation derivation is O(n^2), so
// these hold to a few thousand elements; larger boards are measured scoped.
export const STAGE_BUDGETS_MS = {
    canonicalScene: 300,
    grouping: 800,
    relations: 800,
    serialization: 200,
    resolution: 300,
};

const timeSync = (fn) => {
    const startedAt = performance.now();
    const result = fn();
    return { result, durationMs: performance.now() - startedAt };
};

const timeAsync = async (fn) => {
    const startedAt = performance.now();
    const result = await fn();
    return { result, durationMs: performance.now() - startedAt };
};

const UNBOUNDED_BOARD = { minX: 0, minY: 0, maxX: STRESS_CANVAS_SIZE, maxY: STRESS_CANVAS_SIZE };

// One timed run of every stage; callers repeat it and summarise the samples.
export const measureGroundingStages = async (elements, { shareId = "perf-run", resolveQuery = null } = {}) => {
    const canonicalScene = timeSync(() => buildCanonicalScene(elements));
    const grouping = await timeAsync(() => buildGroupedObjects(shareId, canonicalScene.result));
    const relations = timeSync(() => {
        const labelRelations = attachNearestLabels(grouping.result);
        const graph = [...buildRelationGraph(grouping.result), ...labelRelations];
        return nameObjects(grouping.result, canonicalScene.result, graph, UNBOUNDED_BOARD, () => null);
    });
    const groundedScene = { objects: relations.result, relations: [], canonicalScene: canonicalScene.result };
    const serialization = timeSync(() => serializeSceneContext(groundedScene, { viewport: null, selection: [] }));
    const resolution = timeSync(() => resolveReference(groundedScene, resolveQuery ?? "the first shape"));

    return {
        canonicalScene: canonicalScene.durationMs,
        grouping: grouping.durationMs,
        relations: relations.durationMs,
        serialization: serialization.durationMs,
        resolution: resolution.durationMs,
    };
};

export const summarizeStageSamples = (samplesByStage) =>
    Object.fromEntries(Object.entries(samplesByStage).map(([stage, samples]) => [stage, summarizeFrameTimes(samples)]));
