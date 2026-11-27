import { randomUUID } from "node:crypto";
import { chatCompletion } from "../../backend/src/ai/model/provider.js";
import { decideTurn, readFollowUp } from "../../backend/src/ai/turn/agentTurn.js";
import { buildConversationHistory } from "../../backend/src/ai/turn/conversationHistory.js";
import { createTurnBudget } from "../../backend/src/ai/model/turnBudget.js";
import { createTurnTrace } from "../../backend/src/ai/model/turnTrace.js";
import { buildGroundedScene } from "../../backend/src/grounding/buildGroundedScene.js";
import { serializeSceneContext } from "../../backend/src/grounding/contextSerializer.js";
import { buildDiagram } from "../../shared/canvas/diagramStyles/index.js";
import { buildElementsFromSketch } from "../../shared/canvas/strokes/sketchStrokes.js";

const BASELINE_PROMPT =
    'You are a diagram layout engine. Output ONLY JSON: { "elements": [...] } where each element is ' +
    '{ "kind": "box"|"ellipse"|"arrow"|"line"|"label", "x", "y", "w", "h", "x2", "y2", "text" }. ' +
    "Grid 1200x800, no overlaps, flow top-to-bottom.";
const BASELINE_KINDS = { box: "Rectangle", ellipse: "Ellipse", arrow: "Arrow", line: "Line" };
const INK = "#1f2937";
// What the board gives every element it places, as the diagram and sketch builders in shared/ do.
const placed = (zIndex) => ({ zIndex, rotation: 0, groupId: null, frameId: null, locked: false, opacity: 100 });

const asMap = (entries) => Object.fromEntries(entries.map(({ elementId, element }) => [elementId, element]));

const baselineElement = (item, zIndex) => {
    const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    const [x, y] = [number(item.x), number(item.y)];
    if (x === null || y === null) return null;
    if (item.kind === "label") return { ...placed(zIndex), type: "text", x, y, width: 200, text: String(item.text ?? ""), size: 16, color: INK };
    const shapeType = BASELINE_KINDS[item.kind];
    if (!shapeType) return null;
    const lineLike = item.kind === "arrow" || item.kind === "line";
    const endX = lineLike ? number(item.x2) : x + (number(item.w) ?? 0);
    const endY = lineLike ? number(item.y2) : y + (number(item.h) ?? 0);
    if (endX === null || endY === null) return null;
    return {
        ...placed(zIndex),
        type: "shape",
        shapeType,
        startX: x,
        startY: y,
        endX,
        endY,
        text: lineLike ? undefined : item.text,
        color: INK,
        fillColor: null,
        size: 2,
    };
};

const readBaseline = (raw) => {
    try {
        const items = JSON.parse(raw)?.elements;
        if (!Array.isArray(items) || items.length === 0) return { error: "no elements array" };
        const elements = items.map(baselineElement).filter(Boolean);
        return elements.length > 0 ? { elements } : { error: "no element had usable kind and coordinates" };
    } catch (error) {
        return { error: `not JSON: ${error.message}` };
    }
};

// The first version of the assistant: one prompt for raw coordinates on a fixed grid, and one self-repair.
const runBaseline = async ({ task, apiKey }) => {
    const messages = [
        { role: "system", content: BASELINE_PROMPT },
        { role: "user", content: task.prompt },
    ];
    let raw = await chatCompletion({ apiKey, messages });
    let read = readBaseline(raw);
    if (read.error) {
        messages.push(
            { role: "assistant", content: raw ?? "" },
            { role: "user", content: `That output was invalid: ${read.error}. Return corrected JSON only, following the exact schema.` },
        );
        raw = await chatCompletion({ apiKey, messages });
        read = readBaseline(raw);
    }
    if (read.error) return { outcome: "invalid", error: read.error, elements: {} };
    return { outcome: "drawn", elements: Object.fromEntries(read.elements.map((element) => [randomUUID(), element])) };
};

// Today's assistant: the real turn on an empty board, then the same diagram engine and sketch builder the board uses.
const runMosaic = async ({ task, apiKey }) => {
    const shareId = `benchmark-${task.id}`;
    const scene = await buildGroundedScene(shareId, {});
    const trace = createTurnTrace({ surface: "benchmark", shareId, userId: "benchmark" });
    const { outcome } = await decideTurn({
        apiKey,
        text: task.prompt,
        flagged: false,
        trace,
        turnBudget: createTurnBudget(),
        turnContext: {
            selectionRefs: [],
            clarifiedRef: null,
            mostRecentRef: null,
            recentActions: [],
            history: buildConversationHistory([]),
            knownRefs: new Set(),
            followUp: readFollowUp(task.prompt, [], [], {}),
            buildContext: (charBudget) => serializeSceneContext(scene, { selection: [], charBudget }),
            scene,
            elements: {},
        },
    });
    trace.finish({ outcome: outcome.type });
    if (outcome.type === "diagram") {
        const built = buildDiagram({ model: outcome, recipe: outcome.style ?? {}, generateElementId: randomUUID });
        return { outcome: "drawn", recipe: built.recipe, elements: asMap(built.elements) };
    }
    if (outcome.type === "sketch") {
        const placed = buildElementsFromSketch({
            parts: outcome.parts,
            title: outcome.title,
            targetCenterX: 0,
            targetCenterY: 0,
            color: INK,
            zIndexBase: 0,
            generateElementId: randomUUID,
        });
        return { outcome: "drawn", parts: outcome.parts.map((part) => part.name), elements: asMap(placed) };
    }
    return { outcome: outcome.type, error: outcome.error ?? outcome.message ?? null, elements: {} };
};

export const VARIANTS = {
    baseline: { label: "First version (raw coordinates)", run: runBaseline },
    mosaic: { label: "Mosaic today (intents, layout engine, sketch parts)", run: runMosaic },
};
