// One OpenTelemetry GenAI-style trace per turn, never recording prompt or output text. Logs are the
// durable record; the ring buffer feeds the ops dashboard.
import { randomUUID } from "crypto";
import logger from "../../observability/logger.js";
import { recordAiTurn } from "../../observability/metrics.js";

const MAX_RECENT_TRACES = 100;
const recentTraces = [];

export const getRecentAiTraces = () => [...recentTraces].reverse();

export const createTurnTrace = ({ surface, shareId, userId, conversationId = null }) => {
    const traceId = randomUUID();
    const startedAt = Date.now();
    const spans = [];
    const attributes = { surface, "mosaic.share_id": shareId, "enduser.id": userId, "gen_ai.conversation.id": conversationId };

    const addSpan = (name, spanAttributes = {}, startTime = Date.now(), durationMs = 0) => {
        spans.push({ name, startOffsetMs: startTime - startedAt, durationMs, attributes: spanAttributes });
    };

    return {
        traceId,
        addSpan,
        setAttributes: (extra) => Object.assign(attributes, extra),

        span: async (name, spanAttributes, operation) => {
            const spanStartedAt = Date.now();
            try {
                const result = await operation();
                addSpan(name, spanAttributes, spanStartedAt, Date.now() - spanStartedAt);
                return result;
            } catch (error) {
                addSpan(name, { ...spanAttributes, "error.type": error.code ?? error.name }, spanStartedAt, Date.now() - spanStartedAt);
                throw error;
            }
        },

        finish: ({ outcome, errorType = null }) => {
            const durationMs = Date.now() - startedAt;
            const inference = spans.filter((span) => span.name.startsWith("chat "));
            const inputTokens = inference.reduce((sum, span) => sum + (span.attributes["gen_ai.usage.input_tokens"] ?? 0), 0);
            const outputTokens = inference.reduce((sum, span) => sum + (span.attributes["gen_ai.usage.output_tokens"] ?? 0), 0);
            const trace = { traceId, startedAt, durationMs, outcome, errorType, inputTokens, outputTokens, modelCalls: inference.length, attributes, spans };

            recentTraces.push(trace);
            if (recentTraces.length > MAX_RECENT_TRACES) recentTraces.shift();
            recordAiTurn({
                outcome,
                durationMs,
                inputTokens,
                outputTokens,
                flagged: attributes["mosaic.guard.flagged"] === true,
                usedFallback: attributes["mosaic.fallback_used"] === true,
                errorType,
            });
            logger.info({ trace }, "ai.turn");
            return trace;
        },
    };
};

export const resetTracesForTests = () => {
    recentTraces.length = 0;
};
