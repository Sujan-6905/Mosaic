import { randomUUID } from "crypto";
import { commitPlannedEdit, discardPlannedEdit, planAgentEdit } from "../../ai/edits/agentEdit.js";
import { INTENTS } from "../../ai/turn/agentContract.js";
import { HELP_MESSAGE, REFUSAL_MESSAGE, OVERRIDE_REFUSAL_MESSAGE, decideTurn, readFollowUp, screenInput } from "../../ai/turn/agentTurn.js";
import { buildConversationHistory } from "../../ai/turn/conversationHistory.js";
import { ProviderError, PROVIDER_ERROR_CODES } from "../../ai/model/provider.js";
import { registerTurn, clearTurn } from "../../ai/model/cancellation.js";
import { changedElementCount, describeEditOutcome, describeTurnFailure, isLowRiskPlan, plural, reviewFieldsOf } from "../../ai/turn/turnResponses.js";
import { emitAgentStage, emitAgentTurnDone, STAGES } from "../../ai/turn/agentStages.js";
import AiConversation, { mostRecentLiveRef } from "../../models/aiConversationSchema.js";
import logger from "../../observability/logger.js";
import { recordAiGeneration, recordAiFailure } from "../../observability/metrics.js";
import { sendAlert } from "../../observability/alerts.js";
import { createTurnBudget, TurnBudgetExceededError } from "../../ai/model/turnBudget.js";
import { scanSceneForInjectionAttempts } from "../../ai/safety/promptSafety.js";
import { createTurnTrace } from "../../ai/model/turnTrace.js";
import { getLiveOrPersistedElements } from "../../liveRooms/liveScene.js";
import { getGroundedScene } from "../../grounding/relationCache.js";
import { serializeSceneContext } from "../../grounding/contextSerializer.js";
import { mapElementIdsToRefs } from "../../grounding/buildGroundedScene.js";
import { getRecentUserActions, summarizeRecentActions } from "../../grounding/recentActivity.js";
import { getIo } from "../../realtime/ioRegistry.js";

// Failures are kept in the conversation too. `resolvedRef` records the one object a turn
// acted on, for a later "it" or "that".
const appendConversationTurn = (thread, prompt, assistantMessage, resolvedRef = null) => {
    const turnMessages = [
        { role: "user", content: prompt, createdAt: Date.now() },
        { role: "assistant", createdAt: Date.now(), ...assistantMessage },
    ];
    const args = resolvedRef ? [thread, turnMessages, resolvedRef] : [thread, turnMessages];
    return AiConversation.appendTurn(...args).catch((error) => {
        logger.error({ err: error, shareId: thread.shareId }, "failed to persist AI conversation turn");
    });
};

// Deduped per shareId+ref pair so an unresolved sticky doesn't re-alert on
// every turn against the same board while a human hasn't yet looked at it.
const alertedInjectionRefs = new Set();
const logSuspectedInjection = (shareId, suspectRefs) => {
    const freshRefs = suspectRefs.filter((ref) => !alertedInjectionRefs.has(`${shareId}:${ref}`));
    if (freshRefs.length === 0) return;
    freshRefs.forEach((ref) => alertedInjectionRefs.add(`${shareId}:${ref}`));
    logger.warn({ shareId, refs: freshRefs }, "board content resembling a prompt-injection attempt");
    sendAlert("suspected-prompt-injection", { shareId, refs: freshRefs });
};

const reportProviderFailure = (error) => {
    if (!(error instanceof ProviderError)) return;
    // Exhausting the shared key's quota or losing its access breaks the feature
    // for every user at once, which is worth waking someone for.
    if (error.code === PROVIDER_ERROR_CODES.RATE_LIMITED) sendAlert("ai-quota-exhausted", { status: error.status, model: error.model });
    if (error.code === PROVIDER_ERROR_CODES.AUTH) sendAlert("ai-provider-auth", { status: error.status, model: error.model });
};

const planStatusCode = { invalid: 422, rejected: 422, "needs-repair": 422, "no-op": 200 };

// Every commit path ends here: the response, the conversation entry, and the object acted on.
const finalizeEditResult = async ({ thread, instruction, result, ops, spoken, groundedScene, res, traceId, finishTrace }) => {
    if (result.status !== "applied" && result.status !== "no-op") {
        const message = describeEditOutcome(result);
        await appendConversationTurn(thread, instruction, { content: message, failed: true, traceId });
        const statusCode = result.status === "unauthorized" ? 403 : result.status === "conflict" ? 409 : 422;
        finishTrace(result.status);
        return res.status(statusCode).json({ message, conflicts: result.conflicts, traceId });
    }

    recordAiGeneration();
    finishTrace(result.status);
    if (result.status === "no-op") {
        const message = "That didn't change anything on the board.";
        await appendConversationTurn(thread, instruction, { content: message, traceId });
        return res.status(200).json({ ...result, message, traceId });
    }

    const changeCount = changedElementCount(result);
    const message = spoken?.trim() || `Edited the board (${plural(changeCount, "element")} changed).`;
    const primaryRefs = new Set(ops.filter((op) => op.ref).map((op) => op.ref));
    const resolvedRef =
        primaryRefs.size === 1 ? { ref: [...primaryRefs][0], name: groundedScene.objects.find((object) => object.ref === [...primaryRefs][0])?.name } : null;
    await appendConversationTurn(thread, instruction, { content: message, diff: result.diff, batchId: result.batchId, traceId }, resolvedRef);
    return res.status(200).json({ ...result, message, traceId });
};

const objectTexts = (groundedScene, object) => {
    const canonicalByRef = new Map((groundedScene.canonicalScene?.objects ?? []).map((candidate) => [candidate.ref, candidate]));
    return (object.memberRefs ?? [object.ref])
        .map((memberRef) => canonicalByRef.get(memberRef))
        .filter((member) => member && (member.type === "text" || member.type === "sticky") && member.name)
        .map((member) => member.name.toLowerCase());
};

// A diagram may replace objects only if it carries some of their writing; otherwise it is
// inserted alongside them.
const groundedReplaceRefs = (groundedScene, refs, nodes) => {
    const labels = nodes.map((node) => node.label.toLowerCase());
    const objects = groundedScene.objects.filter((object) => refs.includes(object.ref));
    const texts = objects.flatMap((object) => objectTexts(groundedScene, object));
    const carriesTheirText = texts.length === 0 || texts.some((text) => labels.some((label) => label.includes(text) || text.includes(label)));
    return carriesTheirText ? refs : [];
};

const elementIdsForRefs = (groundedScene, refs) => {
    const wanted = new Set(refs);
    return groundedScene.objects
        .filter((object) => wanted.has(object.ref) && !object.locked)
        .flatMap((object) => object.memberElementIds ?? [object.elementId]);
};

const runTurn = async (req, res) => {
    const { message: rawMessage, selection: selectionElementIds, viewport, review, clarifiedRef, conversationId } = req.body;
    const { shareId } = req.params;
    const { userId } = req.user;
    const thread = { shareId, userId, conversationId };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ message: "The assistant is not configured on this server", code: "not_configured" });
    }

    const trace = createTurnTrace({ surface: review === "direct" ? "mcp" : "panel", shareId, userId, conversationId });
    const { traceId } = trace;
    const finishTrace = (outcome, errorType = null) => trace.finish({ outcome, errorType });
    const turnBudget = createTurnBudget();
    const turnId = randomUUID();
    const controller = registerTurn(turnId);
    const io = getIo();
    let stage = STAGES.UNDERSTANDING;
    let stageStartedAt = emitAgentStage(io, { shareId, userId, turnId, stage });
    const moveToStage = (next) => {
        stageStartedAt = emitAgentStage(io, { shareId, userId, turnId, stage: next, previousStage: stage, previousStartedAt: stageStartedAt });
        stage = next;
    };

    try {
        // Screening the message and reading the board are independent, so neither waits on the other.
        const [{ text: instruction, flagged }, gathered] = await Promise.all([
            screenInput({ apiKey, rawMessage, trace, signal: controller.signal }),
            trace.span("context.gather", {}, () =>
                Promise.all([
                    getLiveOrPersistedElements(shareId, req.drawing.elements).then(async (elements) => ({
                        elements,
                        scene: await getGroundedScene(shareId, elements, viewport),
                    })),
                    getRecentUserActions(shareId, userId),
                    AiConversation.findOwned(thread),
                ]),
            ),
        ]);

        const { groundedScene, turnContext, suspectRefs } = await trace.span("context.build", {}, async () => {
            const [{ elements, scene }, recentActionEntries, conversation] = gathered;
            // A selection is exactly what the person means, so the model is told directly.
            const selectionRefs = mapElementIdsToRefs(scene, selectionElementIds || []);
            const liveRefs = new Set(scene.objects.map((object) => object.ref));
            const suspects = scanSceneForInjectionAttempts(scene);
            logSuspectedInjection(shareId, suspects);
            const mostRecentRef = mostRecentLiveRef(conversation, liveRefs);
            return {
                groundedScene: scene,
                suspectRefs: suspects,
                turnContext: {
                    selectionRefs,
                    clarifiedRef: clarifiedRef && liveRefs.has(clarifiedRef) ? clarifiedRef : null,
                    mostRecentRef,
                    recentActions: summarizeRecentActions(recentActionEntries, scene).map((action) => action.summary),
                    history: buildConversationHistory(conversation?.messages),
                    knownRefs: liveRefs,
                    followUp: readFollowUp(instruction, conversation?.messages, scene.objects, elements, suspects),
                    scene,
                    elements,
                    buildContext: (charBudget) =>
                        serializeSceneContext(scene, { viewport: viewport ?? null, selection: selectionRefs, charBudget, suspectRefs: suspects }),
                },
            };
        });
        const tainted = flagged || suspectRefs.length > 0;
        trace.setAttributes({
            "mosaic.board.object_count": groundedScene.objects.length,
            "mosaic.selection.count": turnContext.selectionRefs.length,
            "mosaic.board.suspect_objects": suspectRefs.length,
        });

        moveToStage(STAGES.PLANNING);
        const { outcome, reask } = await decideTurn({ apiKey, text: instruction, flagged, turnContext, trace, turnBudget, signal: controller.signal });
        trace.setAttributes({ "mosaic.intent": outcome.type });
        moveToStage(STAGES.CHECKING);

        const finishWith = async (status, statusCode, body, stored) => {
            await appendConversationTurn(thread, instruction, { traceId, ...stored });
            finishTrace(status);
            return res.status(statusCode).json({ status, traceId, ...body });
        };

        switch (outcome.type) {
            case INTENTS.REPLY:
                return await finishWith("reply", 200, { message: outcome.message }, { content: outcome.message });

            case INTENTS.REFUSE: {
                const message = flagged || outcome.blockedBy ? OVERRIDE_REFUSAL_MESSAGE : REFUSAL_MESSAGE;
                return await finishWith("refused", 200, { message }, { content: message, refused: true });
            }

            case INTENTS.HELP:
                return await finishWith("help", 200, { message: HELP_MESSAGE }, { content: HELP_MESSAGE, help: true });

            case INTENTS.UNRESOLVED:
                return await finishWith("unresolved", 200, { message: outcome.message }, { content: outcome.message });

            case INTENTS.CLARIFY: {
                const candidates = outcome.candidates
                    .map((ref) => groundedScene.objects.find((object) => object.ref === ref))
                    .filter(Boolean)
                    .map(({ ref, name, bounds }) => ({ ref, name, bounds }));
                if (candidates.length < 2) {
                    const message = "I couldn't tell which object you mean. Select it on the board, then ask again.";
                    return await finishWith("unresolved", 200, { message }, { content: message });
                }
                return await finishWith(
                    "ambiguous",
                    200,
                    { candidates, question: outcome.message, message: outcome.message },
                    { content: outcome.message, ambiguous: true, candidates },
                );
            }

            case INTENTS.DIAGRAM: {
                // Refs found by reading the diagram on the board are already known to be it; only refs the model chose must carry its writing.
                const replaceRefs = outcome.updatesPlacedDiagram ? outcome.replaceRefs : groundedReplaceRefs(groundedScene, outcome.replaceRefs, outcome.nodes);
                const replaces = elementIdsForRefs(groundedScene, replaceRefs);
                const message = outcome.message || `Drew a diagram with ${plural(outcome.nodes.length, "node")}.`;
                recordAiGeneration();
                const payload = {
                    title: outcome.title ?? null,
                    nodes: outcome.nodes,
                    edges: outcome.edges,
                    groups: outcome.groups ?? [],
                    style: outcome.style ?? null,
                    replaces,
                };
                return await finishWith("diagram", 200, { message, ...payload }, { content: message, ...payload });
            }

            case INTENTS.SKETCH: {
                const message = outcome.message || "Drew a sketch.";
                recordAiGeneration();
                return await finishWith(
                    "sketch",
                    200,
                    { message, parts: outcome.parts, title: outcome.title },
                    { content: message, parts: outcome.parts, title: outcome.title },
                );
            }

            case INTENTS.EDIT:
                break;

            default: {
                const message = "I couldn't turn that into something I can do on this board. Try rewording it.";
                recordAiFailure();
                await appendConversationTurn(thread, instruction, { content: message, failed: true, traceId });
                finishTrace("invalid", PROVIDER_ERROR_CODES.INVALID_OUTPUT);
                return res.status(422).json({ message, code: PROVIDER_ERROR_CODES.INVALID_OUTPUT, traceId });
            }
        }

        const planFor = (ops) =>
            trace.span("plan.edit", { "mosaic.op_count": ops.length }, () =>
                planAgentEdit({ shareId, drawing: req.drawing, userId, rawEditBatch: { ops }, tainted }),
            );

        // The geometric re-ask: like decideTurn's schema retry, but for edits that don't make sense spatially.
        let { ops } = outcome;
        let plan = await planFor(ops);
        if (plan.status === "needs-repair") {
            const retried = await reask(`that edit produced a problem: ${plan.complaint}`);
            if (retried.type === INTENTS.EDIT) {
                ({ ops } = retried);
                plan = await planFor(ops);
            }
        }

        if (plan.status !== "planned") {
            const message = plan.status === "no-op" ? "That didn't change anything on the board." : describeEditOutcome(plan);
            await appendConversationTurn(thread, instruction, { content: message, failed: plan.status !== "no-op", traceId });
            finishTrace(plan.status);
            return res.status(planStatusCode[plan.status] ?? 422).json({ status: plan.status === "no-op" ? "no-op" : undefined, message, traceId });
        }

        const returnPlanForReview = async () => {
            const changeCount = changedElementCount(plan);
            const message = `Proposed an edit (${changeCount} change${changeCount === 1 ? "" : "s"}). Review it below.`;
            await appendConversationTurn(thread, instruction, {
                content: message,
                proposal: true,
                token: plan.token,
                diff: plan.diff,
                opsPreview: plan.opsPreview,
                lints: plan.remainingLints,
                traceId,
            });
            finishTrace("planned");
            return res.status(200).json({ status: "planned", message, ...reviewFieldsOf(plan), traceId });
        };

        const lowRisk = isLowRiskPlan(plan, { tainted });
        trace.setAttributes({ "mosaic.plan.low_risk": lowRisk });

        if (review === "preview" || (review === "auto" && !lowRisk)) return await returnPlanForReview();
        if (review === "direct" && !lowRisk) {
            discardPlannedEdit(plan.token, userId);
            const message = "That change is large or destructive, so it needs a person to review it in the board's assistant panel.";
            await appendConversationTurn(thread, instruction, { content: message, failed: true, traceId });
            finishTrace("needs-review");
            return res.status(422).json({ status: "needs-review", message, traceId });
        }

        const result = await trace.span("commit.edit", {}, () =>
            commitPlannedEdit({ token: plan.token, shareId, drawing: req.drawing, userId, correlationId: req.correlationId }),
        );
        return await finalizeEditResult({ thread, instruction, result, ops, spoken: outcome.message, groundedScene, res, traceId, finishTrace });
    } catch (error) {
        if (error.name === "AbortError") {
            const message = "Cancelled.";
            await appendConversationTurn(thread, rawMessage, { content: message, canceled: true, traceId });
            finishTrace("canceled");
            return res.status(200).json({ status: "canceled", message, traceId });
        }
        if (error instanceof TurnBudgetExceededError) {
            const message = "That needed more model calls than one turn allows. Try a simpler request.";
            await appendConversationTurn(thread, rawMessage, { content: message, failed: true, traceId });
            finishTrace("turn-budget-exceeded", "turn_budget");
            return res.status(422).json({ message, code: "turn_budget", traceId });
        }

        recordAiFailure();
        reportProviderFailure(error);
        const failure = describeTurnFailure(error);
        logger.error({ err: error, traceId, shareId, providerCode: error.providerCode, code: failure.code }, "assistant turn failed");
        await appendConversationTurn(thread, rawMessage, { content: failure.message, failed: true, code: failure.code, traceId });
        finishTrace("failed", failure.code);
        return res.status(failure.status).json({ message: failure.message, code: failure.code, retryAfterSeconds: failure.retryAfterSeconds ?? null, traceId });
    } finally {
        emitAgentStage(io, { shareId, userId, turnId, stage: null, previousStage: stage, previousStartedAt: stageStartedAt });
        emitAgentTurnDone(io, { shareId, userId, turnId });
        clearTurn(turnId);
    }
};

export { runTurn };
