// The second model call of a sketch turn: drawing a new picture, redrawing one
// on request, or drawing new parts against what is already on the board.
import { INTENTS } from "./agentContract.js";
import {
    SKETCH_ADDITION_PROMPT,
    SKETCH_RESPONSE_SCHEMA,
    SKETCH_SYSTEM_PROMPT,
    frameExistingDrawing,
    keepGeometryTakeFills,
    parseSketchResponse,
    serializeSketchForFollowUp,
} from "./sketchContract.js";
import { buildUntrustedDataMessage } from "../safety/promptSafety.js";
import { completeOrInvalid } from "./agentOutput.js";

const SKETCH_MAX_OUTPUT_TOKENS = 2_500;
// A drawing is worth a moment's wait for the primary model, since the fallbacks
// draw visibly worse. A question or an edit isn't, and moves straight on.
const SKETCH_MAX_RETRY_WAIT_MS = 30_000;
const SKETCH_TEMPERATURE = 0.3;
const IS_ONLY_COLOUR = /\b(colou?rs?|colou?red|paint|fill|shade|tint)\b/i;

const drawWithOneRetry = async ({ messages, call, signal, parseOptions }) => {
    const complete = () =>
        call({
            messages,
            responseSchema: SKETCH_RESPONSE_SCHEMA,
            temperature: SKETCH_TEMPERATURE,
            maxTokens: SKETCH_MAX_OUTPUT_TOKENS,
            maxRetryWaitMs: SKETCH_MAX_RETRY_WAIT_MS,
            signal,
        });
    const parsed = parseSketchResponse((await completeOrInvalid(complete)).content, parseOptions);
    if (parsed.valid) return parsed;
    messages.push({ role: "user", content: `Your previous response could not be used: ${parsed.error}. Respond again with valid output.` });
    return parseSketchResponse((await completeOrInvalid(complete)).content, parseOptions);
};

// A change starts from the drawing's own commands, and a colour-only change keeps the original lines.
export const drawSketch = async ({ subject, previousParts, boundary, call, signal }) => {
    const messages = previousParts
        ? [
              { role: "system", content: SKETCH_SYSTEM_PROMPT },
              buildUntrustedDataMessage("Current drawing", serializeSketchForFollowUp(previousParts), boundary),
              { role: "user", content: `Change: ${subject}\nReturn every part of the drawing, changed only as asked.` },
          ]
        : [
              { role: "system", content: SKETCH_SYSTEM_PROMPT },
              { role: "user", content: `Request: ${subject}` },
          ];
    const parsed = await drawWithOneRetry({ messages, call, signal });
    if (!parsed.valid) return null;
    return previousParts && IS_ONLY_COLOUR.test(subject) ? keepGeometryTakeFills(previousParts, parsed.parts) : parsed.parts;
};

const NAMES_A_RELATION =
    /\b(near|next to|beside|by|above|below|under|over|behind|in front|on top|on|left of|right of|around|inside|holding|from|between|with)\b/i;
const COMMON_PART_WORDS = new Set(["body", "head", "left", "right", "top", "bottom", "the", "and", "with"]);

// The model usually names what a new drawing relates to. When it doesn't but the
// message plainly places it against something on the board, that's still the board.
export const resolveRelatedObjects = (parsed, text, { scene, knownRefs }) => {
    if (!scene) return [];
    const named = (parsed.relatedRefs ?? []).filter((ref) => knownRefs?.has(ref));
    if (named.length > 0) return scene.objects.filter((object) => named.includes(object.ref));
    if (!NAMES_A_RELATION.test(text)) return [];
    const words = new Set(text.toLowerCase().match(/[\p{L}]{3,}/gu) ?? []);
    return scene.objects.filter((object) =>
        object.name
            ?.toLowerCase()
            .match(/[\p{L}]{3,}/gu)
            ?.some((word) => words.has(word) && !COMMON_PART_WORDS.has(word)),
    );
};

// A drawing that goes with what is already there is drawn against its outlines and
// committed as an edit, so it lands in place instead of following the pointer.
export const drawOntoBoard = async ({ parsed, relatedObjects, elements, boundary, call, signal }) => {
    const related = [...new Set(relatedObjects.flatMap((object) => object.memberElementIds))].map((id) => elements[id]).filter(Boolean);
    const frame = frameExistingDrawing(related);
    const messages = [
        { role: "system", content: SKETCH_ADDITION_PROMPT },
        buildUntrustedDataMessage("Already on the board", frame.description, boundary),
        { role: "user", content: `Request: ${parsed.subject}\nReturn only the new parts.` },
    ];
    const drawn = await drawWithOneRetry({ messages, call, signal, parseOptions: { fit: false } });
    if (!drawn.valid) return { type: "invalid", error: "the drawing could not be read" };

    const ink = related.find((element) => element.type === "path") ?? {};
    const toBoardStroke = (stroke) => ({ ...stroke, points: stroke.points.map(frame.toBoard) });
    return {
        type: INTENTS.EDIT,
        message: parsed.message,
        ops: [
            {
                op: "drawParts",
                title: parsed.title,
                color: ink.color ?? "#000000",
                colorToken: ink.colorToken ?? null,
                parts: drawn.parts.map((part) => ({ name: part.name, fill: part.fill, strokes: part.strokes.map(toBoardStroke) })),
            },
        ],
    };
};
