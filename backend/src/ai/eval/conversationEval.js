// Whole conversations through the real model, grounding and executor, each final board drawn to an
// SVG. Spends quota: `npm run eval:conversations [words]`.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { decideTurn, readFollowUp, screenInput } from "../turn/agentTurn.js";
import { buildConversationHistory } from "../turn/conversationHistory.js";
import { createTurnBudget } from "../model/turnBudget.js";
import { createTurnTrace } from "../model/turnTrace.js";
import { sanitizeEditBatch } from "../edits/sanitize.js";
import { applyBatchToShadowScene, buildGroupIndex } from "../edits/shadowScene.js";
import { buildGroundedScene, mapElementIdsToRefs } from "../../grounding/buildGroundedScene.js";
import { serializeSceneContext } from "../../grounding/contextSerializer.js";
import { buildElementsFromSketch, SKETCH_SIZE_PX } from "../../../../shared/canvas/strokes/sketchStrokes.js";
import { renderBoardSvg } from "./boardSvg.js";
import { CONVERSATIONS } from "./conversationScenarios.js";

const PACE_MS = Number(process.env.EVAL_PACE_MS ?? 20_000);
const RATE_LIMIT_WAIT_MS = 60_000;
const MAX_RATE_LIMIT_WAITS = 20;
const NODE_SIZE = { width: 170, height: 70 };
const NODE_GAP = { x: 60, y: 60 };
const NODES_PER_ROW = 4;

const rightEdgeOf = (elements) => {
    const xs = Object.values(elements).flatMap((element) =>
        element.type === "path" ? element.points.map((point) => point.x) : [element.endX ?? (element.x ?? 0) + (element.width ?? 0)],
    );
    return xs.length > 0 ? Math.max(...xs) : 0;
};

const placeSketch = (elements, { parts, title }) => {
    const placed = buildElementsFromSketch({
        parts,
        title,
        targetCenterX: rightEdgeOf(elements) + SKETCH_SIZE_PX / 2 + 80,
        targetCenterY: 300,
        color: "#111111",
        zIndexBase: Object.keys(elements).length,
        generateElementId: randomUUID,
    });
    return { ...elements, ...Object.fromEntries(placed.map(({ elementId, element }) => [elementId, element])) };
};

// A stand-in for the frontend's diagram layout, which needs the browser bundle:
// the same elements (a shape, a centred label, a bound connector) on a plain grid.
const placeDiagram = (elements, { nodes, edges, replaces = [] }) => {
    const next = { ...elements };
    replaces.forEach((elementId) => delete next[elementId]);
    const originX = rightEdgeOf(next) + 80;
    const shapeIdByNode = new Map();
    nodes.forEach((node, index) => {
        const x = originX + (index % NODES_PER_ROW) * (NODE_SIZE.width + NODE_GAP.x);
        const y = 80 + Math.floor(index / NODES_PER_ROW) * (NODE_SIZE.height + NODE_GAP.y);
        const shapeId = randomUUID();
        shapeIdByNode.set(node.id, shapeId);
        const shapeType = { box: "Rectangle", ellipse: "Ellipse", diamond: "Diamond" }[node.shape] ?? "Rectangle";
        next[shapeId] = {
            type: "shape",
            shapeType,
            startX: x,
            startY: y,
            endX: x + NODE_SIZE.width,
            endY: y + NODE_SIZE.height,
            color: "#111111",
            fillColor: node.fillColor ?? null,
            size: 2,
            opacity: 100,
            zIndex: index,
            rotation: 0,
        };
        next[randomUUID()] = {
            type: "text",
            x: x + 20,
            y: y + 24,
            width: NODE_SIZE.width - 40,
            text: node.label,
            color: "#111111",
            size: 16,
            opacity: 100,
            zIndex: index + 1,
            rotation: 0,
        };
    });
    edges.forEach((edge, index) => {
        const [start, end] = [next[shapeIdByNode.get(edge.from)], next[shapeIdByNode.get(edge.to)]];
        next[randomUUID()] = {
            type: "connector",
            startX: (start.startX + start.endX) / 2,
            startY: (start.startY + start.endY) / 2,
            endX: (end.startX + end.endX) / 2,
            endY: (end.startY + end.endY) / 2,
            startElementId: shapeIdByNode.get(edge.from),
            endElementId: shapeIdByNode.get(edge.to),
            color: "#111111",
            size: 2,
            opacity: 100,
            zIndex: 100 + index,
            rotation: 0,
        };
    });
    return next;
};

const applyEdit = (elements, scene, ops) => {
    const editable = scene.objects.filter((object) => !object.locked);
    const { ops: sanitized } = sanitizeEditBatch(ops, new Set(editable.map((object) => object.ref)));
    const { shadow, opResults } = applyBatchToShadowScene(elements, buildGroupIndex(editable), sanitized);
    return { elements: shadow, failed: opResults.filter((result) => !result.applied).map((result) => `${result.op.op}: ${result.error}`) };
};

const summarize = (outcome) => {
    switch (outcome.type) {
        case "sketch":
            return `${(outcome.parts ?? []).map((part) => part.name).join(", ")}`;
        case "diagram":
            return `${outcome.nodes.map((node) => node.label).join(" / ")} (replaces ${outcome.replaceRefs.length})`;
        case "edit":
            return outcome.ops
                .map((op) => [op.op, op.kind, op.text, op.title, op.parts?.map((part) => part.name).join(",")].filter(Boolean).join(" "))
                .join("; ");
        case "clarify":
            return `${outcome.message} (candidates ${outcome.candidates.join(", ")})`;
        default:
            return outcome.message ?? outcome.error ?? "";
    }
};

const runConversation = async (conversation, apiKey) => {
    const shareId = `eval-${randomUUID()}`;
    let elements = conversation.board ? conversation.board() : {};
    const messages = [];
    const lines = [];
    let failures = 0;

    for (const step of conversation.steps) {
        const trace = createTurnTrace({ surface: "eval", shareId, userId: "eval" });
        const scene = await buildGroundedScene(shareId, elements);
        const selected = step.select
            ? Object.entries(elements)
                  .filter(([, element]) => step.select(element))
                  .map(([id]) => id)
            : [];
        const selectionRefs = mapElementIdsToRefs(scene, selected);
        const { text, flagged } = await screenInput({ apiKey, rawMessage: step.say, trace });
        const startedAt = Date.now();

        const decide = () =>
            decideTurn({
                apiKey,
                text,
                flagged,
                trace,
                turnBudget: createTurnBudget(),
                turnContext: {
                    selectionRefs,
                    clarifiedRef: null,
                    mostRecentRef: null,
                    recentActions: [],
                    history: buildConversationHistory(messages),
                    knownRefs: new Set(scene.objects.map((object) => object.ref)),
                    followUp: readFollowUp(text, messages, scene.objects, elements),
                    buildContext: (charBudget) => serializeSceneContext(scene, { selection: selectionRefs, charBudget }),
                    scene,
                    elements,
                },
            });

        let outcome;
        let note = "";
        for (let waits = 0; !outcome; waits += 1) {
            try {
                ({ outcome } = await decide());
            } catch (error) {
                // A quota refusal says nothing about the assistant, so it waits and goes again.
                if (error.code === "rate_limited" && waits < MAX_RATE_LIMIT_WAITS) {
                    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
                    note = ` (waited ${waits + 1} min for quota)`;
                } else {
                    outcome = { type: "error", error: error.code ?? error.message };
                }
            }
        }
        const { spans } = trace.finish({ outcome: outcome.type });
        const model =
            spans.filter((span) => span.name.startsWith("chat ") && span.attributes["gen_ai.response.model"]).at(-1)?.attributes["gen_ai.response.model"] ??
            "-";

        messages.push({ role: "user", content: text });
        if (outcome.type === "sketch") {
            messages.push({ role: "assistant", content: outcome.message, parts: outcome.parts });
            if (step.place !== false) elements = placeSketch(elements, outcome);
        } else if (outcome.type === "diagram") {
            const replaces = scene.objects.filter((object) => outcome.replaceRefs.includes(object.ref)).flatMap((object) => object.memberElementIds);
            messages.push({ role: "assistant", content: outcome.message, nodes: outcome.nodes, edges: outcome.edges });
            elements = placeDiagram(elements, { ...outcome, replaces });
        } else if (outcome.type === "edit") {
            const applied = applyEdit(elements, scene, outcome.ops);
            elements = applied.elements;
            if (applied.failed.length > 0) note = ` FAILED OPS ${applied.failed.join("; ")}`;
            messages.push({ role: "assistant", content: outcome.message });
        } else {
            messages.push({
                role: "assistant",
                content: outcome.message ?? "",
                failed: outcome.type === "invalid" || outcome.type === "error",
                refused: outcome.type === "refuse",
            });
        }

        const passed = !step.check || step.check(outcome, Object.values(elements));
        if (!passed) failures += 1;
        lines.push(
            `  ${passed ? "PASS" : "FAIL"} "${step.say.slice(0, 80)}" -> ${outcome.type} [${model}, ${Date.now() - startedAt}ms] ${summarize(outcome).slice(0, 260)}${note}`,
        );
        console.log(lines.at(-1));
        await new Promise((resolve) => setTimeout(resolve, PACE_MS));
    }
    return { elements, failures, steps: conversation.steps.length };
};

const main = async () => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    const outputDir = process.env.EVAL_OUTPUT_DIR ?? "src/ai/eval/output";
    mkdirSync(outputDir, { recursive: true });
    const filters = process.argv.slice(2);
    const conversations =
        filters.length > 0 ? CONVERSATIONS.filter((conversation) => filters.some((filter) => conversation.name.includes(filter))) : CONVERSATIONS;

    let failed = 0;
    let total = 0;
    for (const conversation of conversations) {
        console.log(`\n${conversation.name}`);
        const { elements, failures, steps } = await runConversation(conversation, apiKey);
        failed += failures;
        total += steps;
        writeFileSync(join(outputDir, `${conversation.name.replace(/\W+/g, "-")}.svg`), renderBoardSvg(elements));
    }
    console.log(`\n${total - failed} of ${total} steps passed, boards in ${outputDir}`);
    process.exitCode = failed === 0 ? 0 : 1;
};

main();
