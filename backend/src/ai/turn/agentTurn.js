// One turn from message to validated outcome. Guards restrict what a turn may do rather than
// block it, so a screening false positive still works and an attack only drafts reviewed changes.
import { modelCompletion, resolveModelForRole, ProviderError, PROVIDER_ERROR_CODES, PROVIDER_NAME } from "../model/provider.js";
import { callWithResilience } from "../model/resilience.js";
import { recordModelUsage } from "../model/turnBudget.js";
import { AGENT_RESPONSE_SCHEMA, INTENTS, buildSystemPrompt, keepOnlyAskedStyle, parseAgentResponse, structureNoteFor } from "./agentContract.js";
import { describeSketchParts } from "./sketchContract.js";
import { drawSketch, drawOntoBoard, resolveRelatedObjects } from "./agentSketch.js";
import { completeOrInvalid, askAgainOrInvalid } from "./agentOutput.js";
import { chooseDiagramStyle } from "./agentStyle.js";
import { keepBoardLanes, readBoardDiagram, readDiagramBehind } from "./boardDiagram.js";
import {
    buildUntrustedDataMessage,
    createTurnSecrets,
    normalizeUntrustedText,
    scanForInjectionAttempt,
    screenWithPromptGuard,
} from "../safety/promptSafety.js";
import { OUTPUT_BLOCK_REASONS, inspectBoardText, inspectReply } from "../safety/outputGuard.js";

const TURN_DEADLINE_MS = 45_000;
const turnDeadlineMs = () => Number(process.env.AI_TURN_DEADLINE_MS) || TURN_DEADLINE_MS;
// Room for hidden reasoning, since truncation fails JSON validation; the provider reserves it
// against the per-minute quota, so a higher ceiling throttles the next call.
const DECISION_MAX_OUTPUT_TOKENS = 2_500;
// An answer cut off at its limit is asked for once more with this much room. Models that reason before
// answering, or write out every empty field, can need it for a large diagram.
const CUT_OFF_RETRY_TOKENS = 6_000;
const TEMPERATURE = 0.2;

// Input budgets under the free tier's per-minute allowance; each retry after "too large" falls
// back to the next, since only the board context is worth shrinking.
const CONTEXT_CHAR_BUDGETS = [6_000, 2_500];

export const REFUSAL_MESSAGE =
    "That's outside what I can do here. I can answer questions about this board, draw diagrams and sketches, and edit what's on it. Want a diagram of that idea instead?";
export const OVERRIDE_REFUSAL_MESSAGE =
    "I can't follow instructions that try to change how I work. I can answer questions about this board, draw diagrams and sketches, and edit what's on it.";
export const HELP_MESSAGE =
    "Please go through the Help and resources section. It has tutorials and guides for using the whiteboard, along with the keyboard shortcuts.";
export const FLAGGED_UNRESOLVED_MESSAGE = "I couldn't find that on this board.";
export const FLAGGED_CLARIFY_MESSAGE = "Which of these do you mean?";

const MIN_MATCHABLE_NAME_LENGTH = 3;

const FOLLOW_UP_DIAGRAM_NOTE =
    'Your last response in this conversation drew a diagram, and this message is about it. Reply with intent "diagram" and the whole updated diagram: every existing node and edge, plus or minus only what this message asks for, with replaceRefs empty.';
const FOLLOW_UP_BOARD_NOTE =
    "Your last response drew a diagram, but this message names an object on the board. It is about that object, so use its ref and do not change the diagram.";
const DIAGRAM_ON_BOARD_NOTE =
    'Your last diagram is on the board now, and its current nodes and edges are in the data block after this. Renaming or recolouring a node is an edit on its ref. Adding, removing or reordering steps is intent "diagram" with the whole updated diagram: every remaining node and edge as they are now, plus or minus what this message asks for, using the same labels. Never use add for a step, and never clarify these.';
const FOLLOW_UP_SKETCH_NOTE =
    'Your last response drew a sketch, not yet on the board. Its parts and where they sit are in the data block after this. A question about it, such as where something is, gets intent "reply" using those positions. A request to change it, such as adding colour or another detail, gets intent "sketch" with sketch.subject saying only what changes and relatedRefs empty. A request for a different drawing gets intent "sketch" with the new subject. Never clarify or use unresolved for these.';
const SKETCH_ON_BOARD_NOTE =
    'Your last sketch is on the board now, as the objects named after its parts. Colouring, moving, resizing, rotating or deleting it or a part of it is an edit on those refs. Adding something to the picture is intent "sketch" with relatedRefs. A question about it gets intent "reply". A request for a separate new drawing gets intent "sketch" with relatedRefs empty. Never clarify or use unresolved for these.';

const SHAPE_NODE_KINDS = { Rectangle: "box", Ellipse: "ellipse", Circle: "ellipse", Diamond: "diamond" };

// The diagram as it stands, walked from any node still carrying its drawn label, since later
// edits may have renamed or recoloured nodes.
const readPlacedDiagram = (nodes, objects, elements, suspectRefs) => {
    const labels = new Set(nodes.map((node) => node.label.toLowerCase()));
    const connectors = objects.filter((object) => object.type === "connector" && object.startElementId && object.endElementId);
    const nodeObjects = objects.filter((object) => object.type !== "connector" && !object.wholeSketch);
    const ownerOf = (elementId) => nodeObjects.find((object) => object.memberElementIds.includes(elementId));

    const found = new Set(nodeObjects.filter((object) => labels.has(object.name?.toLowerCase())).map((object) => object.ref));
    if (found.size === 0) return null;
    for (let grew = true; grew;) {
        grew = false;
        connectors.forEach(({ startElementId, endElementId }) => {
            const [start, end] = [ownerOf(startElementId), ownerOf(endElementId)];
            if (!start || !end || found.has(start.ref) === found.has(end.ref)) return;
            found.add(start.ref);
            found.add(end.ref);
            grew = true;
        });
    }

    const placed = nodeObjects.filter((object) => found.has(object.ref));
    // Labels go to the model as data and would come back as the new diagram's text, so
    // a diagram holding text that reads like instructions isn't offered for rewriting.
    if (placed.some((object) => suspectRefs.includes(object.ref))) return null;
    const usedConnectors = connectors.filter(
        ({ startElementId, endElementId }) => found.has(ownerOf(startElementId)?.ref) && found.has(ownerOf(endElementId)?.ref),
    );
    const shapeOf = (object) => object.memberElementIds.map((id) => elements[id]).find((element) => element?.type === "shape");
    return {
        nodes: placed.map((object) => {
            const shape = shapeOf(object);
            return {
                id: object.ref,
                label: object.name,
                shape: SHAPE_NODE_KINDS[shape?.shapeType] ?? "box",
                ...(shape?.fillColor ? { fillColor: shape.fillColor } : {}),
            };
        }),
        edges: usedConnectors.map(({ startElementId, endElementId }) => ({ from: ownerOf(startElementId).ref, to: ownerOf(endElementId).ref })),
        refs: [...placed, ...usedConnectors].map((object) => object.ref),
    };
};

// Right after a diagram the model confuses diagram edits with board edits, so it's told which
// one a message is. `diagram` is set only when the message is about that diagram.
export const readFollowUp = (message, storedMessages = [], objects = [], elements = {}, suspectRefs = []) => {
    const answers = storedMessages.filter((stored) => stored.role === "assistant" && !stored.failed && !stored.refused);
    const lastResponse = answers.at(-1);
    const objectNames = objects.map((object) => object.name);
    if (lastResponse?.parts?.length) {
        const placedNames = new Set(objectNames.map((name) => name?.toLowerCase()));
        const placed = lastResponse.parts.some((part) => placedNames.has(part.name.toLowerCase()));
        return placed ? { note: SKETCH_ON_BOARD_NOTE, diagram: null } : { note: FOLLOW_UP_SKETCH_NOTE, diagram: null, sketchParts: lastResponse.parts };
    }

    const lastDiagram = answers.findLast((stored) => stored.nodes?.length);
    const placedDiagram = lastDiagram ? readPlacedDiagram(lastDiagram.nodes, objects, elements, suspectRefs) : null;
    if (placedDiagram)
        return (
            readDiagramBehind(placedDiagram.refs, objects, elements, suspectRefs) ?? {
                note: DIAGRAM_ON_BOARD_NOTE,
                diagram: { nodes: placedDiagram.nodes, edges: placedDiagram.edges },
                placedDiagram,
            }
        );

    if (!lastResponse?.nodes?.length) return readBoardDiagram(message, objects, elements, suspectRefs) ?? { note: null, diagram: null };
    const lowered = message.toLowerCase();
    const namesObject = objectNames.some((name) => name && name.length >= MIN_MATCHABLE_NAME_LENGTH && lowered.includes(name.toLowerCase()));
    return namesObject
        ? { note: FOLLOW_UP_BOARD_NOTE, diagram: null }
        : { note: FOLLOW_UP_DIAGRAM_NOTE, diagram: { nodes: lastResponse.nodes, edges: lastResponse.edges ?? [] } };
};

const NAMES_WORDS_OR_LAYOUT =
    /\b(notes?|stick(y|ies)|labels?|texts?|titles?|headings?|captions?|boxe?s?|rectangles?|circles?|ellipses?|diamonds?|shapes?|steps?|nodes?|stages?|columns?|rows?|lists?|tables?|items?|cards?|tasks?|ideas?|says?|saying|called|named|comments?|kanban|summar\w+|translat\w+)\b/i;
const ASKS_FOR_NEW_DRAWING = /\b(create|draw|sketch|doodle|make|paint|add|put|place)\b.*\b(a|an|another|new|one more)\b/i;
const REFERS_TO_EXISTING = /\b(it|this|that|these|those|them|selected|selection)\b/i;

const namedExactly = (name, text) =>
    Boolean(name) && name.length >= MIN_MATCHABLE_NAME_LENGTH && new RegExp(`(^|\\W)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(text);

// Rejects questions nobody can usefully answer: a name the message spells out exactly, "draw another cat" asking which cat, refs while
// something is selected, or a drawing against its own part ("which sun?").
export const clarifyComplaint = (parsed, text, { selectionRefs = [], knownRefs = null, followUp = null, scene = null }) => {
    if ((parsed.type === INTENTS.CLARIFY || parsed.type === INTENTS.UNRESOLVED) && followUp?.sketchParts) {
        return 'this is about the sketch you just drew, so answer with intent "reply" using its parts, or change it with intent "sketch"';
    }
    if (
        (parsed.type === INTENTS.CLARIFY || parsed.type === INTENTS.UNRESOLVED) &&
        ASKS_FOR_NEW_DRAWING.test(text) &&
        !REFERS_TO_EXISTING.test(text) &&
        !NAMES_WORDS_OR_LAYOUT.test(text)
    ) {
        return 'this asks for something new to be drawn, so use intent "sketch" or "diagram". Anything it mentions that is not on the board yet, such as a collar on a dog, gets drawn as part of it, so do not report it as missing';
    }
    if (parsed.type !== INTENTS.CLARIFY) return null;
    if (selectionRefs.length > 0) return `the user already selected ${selectionRefs.join(", ")}, so act on exactly those instead of asking`;
    const usable = knownRefs ? parsed.candidates.filter((ref) => knownRefs.has(ref)) : parsed.candidates;
    if (usable.length < 2) return "candidates must be at least two refs from the board data. If only one object fits, act on it";
    const named = usable.filter((ref) => namedExactly(scene?.objects.find((object) => object.ref === ref)?.name, text));
    if (named.length === 1) return `the message names ${named[0]} exactly, so act on it instead of asking`;
    const whole = scene?.objects.find(
        (object) => object.wholeSketch && usable.includes(object.ref) && usable.every((ref) => ref === object.ref || object.partRefs.includes(ref)),
    );
    return whole
        ? `${whole.ref} is the whole drawing and the other candidates are parts of it, so they don't tie: act on ${whole.ref} instead of asking`
        : null;
};

const ASKS_FOR_FEWER_NODES = /\b(remove|delete|drop|without|replace|instead|rename|shorter|simplify|simpler|fewer|merge|combine|only|redo|start over)\b/i;

const graphSignature = ({ nodes, edges }) =>
    JSON.stringify([
        nodes.map(({ label, shape, fillColor }) => [label, shape ?? "box", fillColor ?? null]),
        edges.map(({ from, to, label }) => [from, to, label ?? null]),
    ]);

// A diagram change that drops an unrelated node, or returns the graph unchanged, gets one more try.
const followUpComplaint = (previous, updated, message) => {
    if (!previous) return null;
    if (graphSignature(previous) === graphSignature(updated)) return "the diagram you returned is unchanged, so it doesn't do what was asked";
    if (ASKS_FOR_FEWER_NODES.test(message)) return null;
    const kept = new Set(updated.nodes.map((node) => node.label.toLowerCase()));
    const dropped = previous.nodes.map((node) => node.label).filter((label) => !kept.has(label.toLowerCase()));
    return dropped.length > 0 ? `the updated diagram lost these nodes, which must stay: ${dropped.join(", ")}` : null;
};

// Only text this file wrote goes in a system message. Part names and board text
// are shaped by whatever the model last read, so they stay in spotlighted data.
export const buildMessages = ({
    secrets,
    message,
    buildContext,
    contextLevel,
    history,
    recentActions,
    mostRecentRef,
    selectionRefs,
    clarifiedRef,
    followUp,
}) => {
    const context = buildContext(CONTEXT_CHAR_BUDGETS[contextLevel]);
    const messages = [{ role: "system", content: buildSystemPrompt({ canary: secrets.canary }) }];

    if (selectionRefs.length > 0) {
        messages.push({
            role: "system",
            content: `The user has these objects selected: ${selectionRefs.join(", ")}. "This", "these", "them" and "the selection" mean exactly those refs.`,
        });
    } else {
        messages.push({ role: "system", content: "Nothing is selected on the board right now." });
    }
    if (clarifiedRef) messages.push({ role: "system", content: `The user has confirmed: use ${clarifiedRef} for this request.` });

    messages.push(buildUntrustedDataMessage("Current board", context, secrets.boundary));
    if (recentActions.length > 0) {
        messages.push(buildUntrustedDataMessage("The user's own recent actions on this board, most recent first", recentActions.join("; "), secrets.boundary));
    }
    if (mostRecentRef) {
        messages.push(
            buildUntrustedDataMessage(
                `A bare "it" or "that" most likely means ${mostRecentRef.ref}, which the previous turn acted on. Its name`,
                mostRecentRef.name ?? mostRecentRef.ref,
                secrets.boundary,
            ),
        );
    }
    messages.push(...history);
    if (followUp?.note) messages.push({ role: "system", content: followUp.note });
    if (followUp?.sketchParts)
        messages.push(buildUntrustedDataMessage("Parts of your last sketch", describeSketchParts(followUp.sketchParts), secrets.boundary));
    if (followUp?.placedDiagram)
        messages.push(
            buildUntrustedDataMessage(
                "The diagram on the board now",
                JSON.stringify({ nodes: followUp.placedDiagram.nodes, edges: followUp.placedDiagram.edges }),
                secrets.boundary,
            ),
        );
    const structureNote = structureNoteFor(message);
    if (structureNote) messages.push({ role: "system", content: structureNote });
    messages.push({ role: "user", content: message });
    return messages;
};

export const modelChain = () => [...new Set([resolveModelForRole("reasoning"), ...resolveModelForRole("fallback").split(",")])];

const styleModelChain = () => [...new Set([resolveModelForRole("stylist"), ...modelChain()])];

const callModel = async ({
    apiKey,
    messages,
    responseSchema = AGENT_RESPONSE_SCHEMA,
    temperature = TEMPERATURE,
    maxTokens = DECISION_MAX_OUTPUT_TOKENS,
    maxRetryWaitMs,
    trace,
    turnBudget,
    signal,
    deadlineAt,
    models = modelChain(),
}) => {
    turnBudget.spend();
    const primaryModel = models[0];
    const result = await callWithResilience({
        models,
        deadlineAt,
        signal,
        maxRetryWaitMs,
        call: (model, attemptSignal) => modelCompletion({ apiKey, model, messages, responseSchema, maxTokens, temperature, signal: attemptSignal }),
        onAttempt: ({ model, attempt, durationMs, result: attemptResult, error, skipped }) => {
            if (model !== primaryModel) trace.setAttributes({ "mosaic.fallback_used": true });
            trace.addSpan(
                `chat ${model}`,
                {
                    "gen_ai.operation.name": "chat",
                    "gen_ai.provider.name": PROVIDER_NAME,
                    "gen_ai.request.model": model,
                    ...(attempt ? { "mosaic.retry_attempt": attempt } : {}),
                    ...(skipped ? { "mosaic.skipped": skipped } : {}),
                    ...(attemptResult
                        ? {
                              "gen_ai.response.model": attemptResult.model,
                              "gen_ai.response.id": attemptResult.responseId,
                              "gen_ai.response.finish_reasons": [attemptResult.finishReason],
                              "gen_ai.usage.input_tokens": attemptResult.usage?.inputTokens,
                              "gen_ai.usage.output_tokens": attemptResult.usage?.outputTokens,
                          }
                        : {}),
                    ...(error ? { "error.type": error.code } : {}),
                },
                Date.now() - (durationMs ?? 0),
                durationMs ?? 0,
            );
        },
    });
    recordModelUsage({ usage: result.usage, promptText: JSON.stringify(messages), responseText: result.content ?? "" });
    if (result.finishReason === "length" && maxTokens < CUT_OFF_RETRY_TOKENS) {
        trace.setAttributes({ "mosaic.cut_off_retry": true });
        return callModel({
            apiKey,
            messages,
            responseSchema,
            temperature,
            maxTokens: CUT_OFF_RETRY_TOKENS,
            maxRetryWaitMs,
            trace,
            turnBudget,
            signal,
            deadlineAt,
            models,
        });
    }
    return result;
};

// Text alongside a drawing or edit: a flagged turn loses it, code costs only the sentence, and a
// leak or secret blocks the turn.
const inspectSpokenText = (message, { canary, flagged }) => {
    if (flagged) return { text: "" };
    const inspected = inspectReply(message, { canary });
    return inspected.blocked === OUTPUT_BLOCK_REASONS.CODE ? { text: "" } : inspected;
};

// Every model output passes here. A flagged turn may still propose a reviewed change but can't
// speak freely, since free text is what an override would exploit.
export const applyOutputGuard = (parsed, { secrets, flagged, trace }) => {
    const { canary } = secrets;
    const block = (reason) => {
        trace.setAttributes({ "mosaic.guard.output_blocked": reason });
        return { type: INTENTS.REFUSE, blockedBy: reason };
    };
    const withBoardText = (texts) => {
        const onBoard = inspectBoardText(texts, { canary });
        if (onBoard.blocked) return block(onBoard.blocked);
        const spoken = inspectSpokenText(parsed.message, { canary, flagged });
        return spoken.blocked ? block(spoken.blocked) : { ...parsed, message: spoken.text };
    };

    switch (parsed.type) {
        case INTENTS.REPLY:
        case INTENTS.UNRESOLVED:
        case INTENTS.CLARIFY: {
            if (flagged && parsed.type === INTENTS.REPLY) return block("flagged-input");
            if (flagged) return { ...parsed, message: parsed.type === INTENTS.CLARIFY ? FLAGGED_CLARIFY_MESSAGE : FLAGGED_UNRESOLVED_MESSAGE };
            const inspected = inspectReply(parsed.message, { canary });
            return inspected.blocked ? block(inspected.blocked) : { ...parsed, message: inspected.text };
        }
        case INTENTS.SKETCH:
            return withBoardText([parsed.title, ...parsed.parts.map((part) => part.name)]);
        case INTENTS.DIAGRAM:
            return withBoardText([...parsed.nodes.map((node) => node.label), ...parsed.edges.map((edge) => edge.label)]);
        case INTENTS.EDIT:
            return withBoardText(parsed.ops.flatMap((op) => [op.text, op.label, op.title, ...(op.parts ?? []).map((part) => part.name)]));
        default:
            return parsed;
    }
};

export const screenInput = async ({ apiKey, rawMessage, trace, signal }) => {
    const { text, hadHiddenChars } = normalizeUntrustedText(rawMessage);
    const patternMatched = scanForInjectionAttempt(text);
    const guard = await trace.span("guard.input", {}, () => screenWithPromptGuard({ apiKey, text, signal }));
    const flagged = hadHiddenChars || patternMatched || guard.flagged;
    trace.setAttributes({
        "mosaic.guard.flagged": flagged,
        "mosaic.guard.pattern_match": patternMatched,
        "mosaic.guard.hidden_chars": hadHiddenChars,
        "mosaic.guard.classifier_score": guard.score,
        "mosaic.guard.classifier_available": guard.available,
    });
    return { text, flagged };
};

const ASKS_TO_ADD_OR_DRAW = /\b(add|draw|sketch|put|place)\b/i;

// The failure this catches: "add a human and a leash" coming back as boxes labelled
// "human" and "leash", which is a valid edit and looks like nothing that was asked.
const drawsAPictureWithBoxes = (parsed, text) =>
    ASKS_TO_ADD_OR_DRAW.test(text) && !NAMES_WORDS_OR_LAYOUT.test(text) && parsed.ops.some((op) => op.op === "add");

// Returns { outcome, reask } where `reask(complaint)` asks the model once more
// about the same request, for a caller whose own later check found a problem.
export const decideTurn = async ({ apiKey, text, flagged, turnContext, trace, turnBudget, signal }) => {
    const followUp = turnContext.followUp;
    trace.setAttributes({
        "mosaic.follow_up": followUp?.fromBoard ? "board_diagram" : followUp?.placedDiagram ? "placed_diagram" : followUp?.note ? "conversation" : "none",
    });
    const deadlineAt = Date.now() + turnDeadlineMs();
    const secrets = createTurnSecrets();
    let contextLevel = 0;
    let messages = buildMessages({ ...turnContext, secrets, message: text, contextLevel });

    const complete = async () => {
        try {
            return await callModel({ apiKey, messages, trace, turnBudget, signal, deadlineAt });
        } catch (error) {
            const canShrink = error instanceof ProviderError && error.code === PROVIDER_ERROR_CODES.TOO_LARGE && contextLevel < CONTEXT_CHAR_BUDGETS.length - 1;
            if (!canShrink) throw error;
            contextLevel += 1;
            trace.setAttributes({ "mosaic.context_shrunk": true });
            messages = buildMessages({ ...turnContext, secrets, message: text, contextLevel });
            return callModel({ apiKey, messages, trace, turnBudget, signal, deadlineAt });
        }
    };

    // Rejected model output is never replayed into the conversation: only the
    // validator's complaint is, so nothing it said can steer the second attempt.
    const askAgain = async (complaint) => {
        messages = [
            ...messages,
            { role: "user", content: `Your previous response could not be used: ${complaint}. Respond again with valid output for my request.` },
        ];
        return parseAgentResponse((await complete()).content);
    };

    let parsed = parseAgentResponse((await completeOrInvalid(complete)).content);
    if (parsed.type === "invalid") {
        trace.addSpan("validate.response", { "error.type": "invalid_output" });
        parsed = await askAgainOrInvalid(askAgain, parsed.error);
    }

    const askedBadly = clarifyComplaint(parsed, text, turnContext);
    if (askedBadly) {
        trace.addSpan("validate.clarify", { "error.type": "needless_question" });
        const retried = await askAgainOrInvalid(askAgain, askedBadly);
        if (retried.type !== "invalid") parsed = retried;
    }

    if (parsed.type === INTENTS.EDIT && drawsAPictureWithBoxes(parsed, text)) {
        trace.addSpan("validate.edit", { "error.type": "picture_as_boxes" });
        const retried = await askAgainOrInvalid(
            askAgain,
            'that asks for a picture of a real thing, so use intent "sketch", with relatedRefs when it goes with something on the board, instead of adding labelled boxes',
        );
        if (retried.type === INTENTS.SKETCH) parsed = retried;
    }

    if (parsed.type === INTENTS.SKETCH) {
        const call = (options) => callModel({ apiKey, trace, turnBudget, deadlineAt, ...options });
        const previousParts = turnContext.followUp?.sketchParts ?? null;
        const relatedObjects = previousParts ? [] : resolveRelatedObjects(parsed, text, turnContext);
        if (relatedObjects.length > 0) {
            parsed = await drawOntoBoard({ parsed, relatedObjects, elements: turnContext.elements, boundary: secrets.boundary, call, signal });
        } else {
            const parts = await drawSketch({ subject: parsed.subject, previousParts, boundary: secrets.boundary, call, signal });
            parsed = parts
                ? { type: INTENTS.SKETCH, message: parsed.message, title: parsed.title, parts }
                : { type: "invalid", error: "the drawing could not be read" };
        }
    }

    if (parsed.type === INTENTS.DIAGRAM) {
        const complaint = followUpComplaint(turnContext.followUp?.diagram, parsed, text);
        if (complaint) {
            trace.addSpan("validate.follow_up", { "error.type": "unfaithful_update" });
            const retried = await askAgainOrInvalid(askAgain, complaint);
            if (retried.type === INTENTS.DIAGRAM) parsed = retried;
        }
        // The update replaces what's on the board, or both versions would sit side by side.
        const placedDiagram = turnContext.followUp?.placedDiagram;
        if (placedDiagram && parsed.type === INTENTS.DIAGRAM) parsed = { ...parsed, replaceRefs: placedDiagram.refs, updatesPlacedDiagram: true };
        if (turnContext.followUp?.fromBoard && parsed.type === INTENTS.DIAGRAM) parsed = keepBoardLanes(parsed, turnContext.followUp.diagram, text);
    }

    if (parsed.type === INTENTS.DIAGRAM) {
        const styleCall = (options) => callModel({ apiKey, trace, turnBudget, deadlineAt, models: styleModelChain(), ...options });
        const style = await trace.span("style.choose", {}, () =>
            chooseDiagramStyle({
                text,
                diagram: parsed,
                previousStyle: turnContext.followUp?.diagram?.style ?? null,
                call: styleCall,
                boundary: secrets.boundary,
                signal,
            }),
        );
        parsed = { ...parsed, style };
    }

    const finish = (decided) => applyOutputGuard(keepOnlyAskedStyle(decided, text), { secrets, flagged, trace });
    return { outcome: finish(parsed), reask: async (complaint) => finish(await askAgainOrInvalid(askAgain, complaint)) };
};
