// Picks a new diagram's style in two calls: a shortlist from one line per option, then a choice
// from the shortlist's full detail. A genuine toss-up is put to the person with previews.
import {
    STRUCTURES,
    LOOKS,
    isStructureId,
    isLookId,
    structureSummaries,
    lookSummaries,
    structureDetails,
    lookDetails,
    DEFAULT_LOOK_ID,
} from "../../../../shared/canvas/diagramStyles/catalog.js";
import { explicitStyleIn, structureFit, rankStructures } from "../../../../shared/canvas/diagramStyles/ranking.js";
import { buildUntrustedDataMessage } from "../safety/promptSafety.js";
import { completeOrInvalid } from "./agentOutput.js";

const SHORTLIST_SIZE = 5;
const LOOK_SHORTLIST_SIZE = 4;
const MAX_CHOICES = 3;
const STYLE_MAX_OUTPUT_TOKENS = 600;
const POOR_FIT = 0.4;

const STRUCTURE_IDS = STRUCTURES.map((structure) => structure.id);
const LOOK_IDS = LOOKS.map((look) => look.id);

const enumOf = (values) => ({ type: "string", enum: values });
const objectOf = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const SHORTLIST_SCHEMA = {
    name: "style_shortlist",
    schema: objectOf({ structures: { type: "array", items: enumOf(STRUCTURE_IDS) }, looks: { type: "array", items: enumOf(LOOK_IDS) } }),
};

const DECISION_SCHEMA = {
    name: "style_decision",
    schema: objectOf({
        structure: enumOf(STRUCTURE_IDS),
        look: enumOf(LOOK_IDS),
        confident: { type: "boolean" },
        why: { type: "string" },
        alternatives: { type: "array", items: objectOf({ structure: enumOf(STRUCTURE_IDS), look: enumOf(LOOK_IDS), why: { type: "string" } }) },
    }),
};

const SHORTLIST_PROMPT = `You pick how a whiteboard diagram should be drawn. A structure is where things go; a look is how they are drawn. Read the request and the content summary, then shortlist up to ${SHORTLIST_SIZE} structures and up to ${LOOK_SHORTLIST_SIZE} looks that could fit, best first. Prefer what the request names or implies (a "mind map", "for kids", "dark slides"). With no hint about mood, include ink. Only use ids from the lists.`;

const DECISION_PROMPT = `You decide how a whiteboard diagram should be drawn, from a shortlist. Pick the one structure and one look that best fit the request and the content, using the details given for each. Set confident to false only when two structures are a genuine toss-up for this request, and then list the close ones in alternatives (best first, at most ${MAX_CHOICES - 1}), each with a short why a person would understand. why is one short sentence. Only use ids from the shortlist.`;

// What the content offers a structure, without its words: shapes of data, not text.
const describeContent = (diagram) => {
    const nodes = diagram.nodes ?? [];
    const has = (field) => nodes.filter((node) => node[field] !== null && node[field] !== undefined && node[field] !== "").length;
    const kinds = [...new Set(nodes.map((node) => node.kind).filter(Boolean))];
    return [
        `${nodes.length} nodes, ${(diagram.edges ?? []).length} links, ${(diagram.groups ?? []).length} groups`,
        `fields: parent ${has("parent")}, group ${has("group")}, lane ${has("lane")}, status ${has("status")}, value ${has("value")}, start ${has("start")}, end ${has("end")}, x/y ${has("x")}`,
        kinds.length ? `kinds: ${kinds.join(", ")}` : "no kinds",
        `labelled links ${(diagram.edges ?? []).filter((edge) => edge.label).length}`,
    ].join("; ");
};

const valid = (ids, isValid, limit) => [...new Set((ids ?? []).filter(isValid))].slice(0, limit);

// Without a model, or when it fails: what the words name, ranked by how well each fits the content.
export const fallbackStyle = (text, diagram, explicit = explicitStyleIn(text)) => {
    const ranked = explicit.structure ? [explicit.structure] : rankStructures(text, diagram, MAX_CHOICES);
    const look = explicit.look ?? DEFAULT_LOOK_ID;
    return { structure: ranked[0], look, certain: true, choices: [], source: "ranked" };
};

const withChoices = (decision, diagram) => {
    const fit = structureFit(decision.structure, diagram);
    const alternatives = (decision.alternatives ?? []).filter((alternative) => alternative.structure !== decision.structure);
    const certain = decision.confident !== false && fit >= POOR_FIT;
    if (certain || alternatives.length === 0)
        return { structure: decision.structure, look: decision.look, certain: true, choices: [], why: decision.why ?? null };
    const choices = [{ structure: decision.structure, look: decision.look, why: decision.why ?? "" }, ...alternatives].slice(0, MAX_CHOICES);
    return { structure: decision.structure, look: decision.look, certain: false, choices, why: decision.why ?? null };
};

// `previousStyle` is the style of the diagram this turn updates, kept unless the message asks for another.
export const chooseDiagramStyle = async ({ text, diagram, previousStyle = null, call, boundary, signal }) => {
    const explicit = explicitStyleIn(text);
    if (previousStyle && !explicit.structure && !explicit.look) return { ...previousStyle, certain: true, choices: [], source: "previous" };
    if (explicit.structure && explicit.look) return { structure: explicit.structure, look: explicit.look, certain: true, choices: [], source: "named" };
    // Restyling a diagram already drawn changes only what the message names.
    if (previousStyle)
        return {
            ...previousStyle,
            structure: explicit.structure ?? previousStyle.structure,
            look: explicit.look ?? previousStyle.look,
            certain: true,
            choices: [],
            source: "named",
        };
    const request = buildUntrustedDataMessage("The request", text, boundary);
    const content = { role: "user", content: `Content summary: ${describeContent(diagram)}` };

    try {
        let structures = explicit.structure ? [explicit.structure] : null;
        let looks = explicit.look ? [explicit.look] : null;
        if (!structures || !looks) {
            const shortlistReply = await completeOrInvalid(() =>
                call({
                    messages: [
                        { role: "system", content: SHORTLIST_PROMPT },
                        { role: "system", content: `Structures:\n${structureSummaries()}\n\nLooks:\n${lookSummaries()}` },
                        request,
                        content,
                    ],
                    responseSchema: SHORTLIST_SCHEMA,
                    maxTokens: STYLE_MAX_OUTPUT_TOKENS,
                    signal,
                }),
            );
            const shortlist = JSON.parse(shortlistReply.content || "{}");
            structures ??= valid(shortlist.structures, isStructureId, SHORTLIST_SIZE);
            looks ??= valid(shortlist.looks, isLookId, LOOK_SHORTLIST_SIZE);
        }
        if (structures.length === 0) return fallbackStyle(text, diagram, explicit);
        if (looks.length === 0) looks = [DEFAULT_LOOK_ID];
        if (structures.length === 1 && looks.length === 1) return { structure: structures[0], look: looks[0], certain: true, choices: [], source: "shortlist" };

        const decisionReply = await completeOrInvalid(() =>
            call({
                messages: [
                    { role: "system", content: DECISION_PROMPT },
                    { role: "system", content: `Shortlisted structures:\n${structureDetails(structures)}\n\nShortlisted looks:\n${lookDetails(looks)}` },
                    request,
                    content,
                ],
                responseSchema: DECISION_SCHEMA,
                maxTokens: STYLE_MAX_OUTPUT_TOKENS,
                signal,
            }),
        );
        const decision = JSON.parse(decisionReply.content || "{}");
        if (!isStructureId(decision.structure) || !structures.includes(decision.structure)) return fallbackStyle(text, diagram, explicit);
        const look = isLookId(decision.look) ? decision.look : looks[0];
        const alternatives = (decision.alternatives ?? []).filter((alternative) => structures.includes(alternative.structure) && isLookId(alternative.look));
        return { ...withChoices({ ...decision, look, alternatives }, diagram), source: "model" };
    } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        return fallbackStyle(text, diagram, explicit);
    }
};
