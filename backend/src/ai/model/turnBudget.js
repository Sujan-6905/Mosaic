// The per-turn call ceiling and usage recording. No daily cap per person: the shared key's rate
// limits are the ceiling.
import { recordAiModelCall } from "../../observability/metrics.js";

// A healthy turn makes three or four calls; this stops any unbounded retry loop.
const MAX_MODEL_CALLS_PER_TURN = 6;

// Not every provider response carries token usage; ~4 characters per token is
// the usual approximation for English text.
const CHARS_PER_TOKEN_APPROX = 4;
export const estimateTokens = (text) => Math.ceil((text?.length || 0) / CHARS_PER_TOKEN_APPROX);

export class TurnBudgetExceededError extends Error {
    constructor(calls) {
        super(`Turn exceeded the per-turn model call ceiling (${calls} calls)`);
        this.name = "TurnBudgetExceededError";
        this.calls = calls;
    }
}

// `usage` is the provider's own count when it sent one; the texts are the estimate's fallback.
export const recordModelUsage = ({ promptText = "", responseText = "", usage = null } = {}) => {
    recordAiModelCall(usage ? usage.inputTokens + usage.outputTokens : estimateTokens(promptText) + estimateTokens(responseText));
};

// `spend()` throws once the ceiling is crossed, so a retry loop stops before
// paying for one more call past the limit.
export const createTurnBudget = () => {
    let calls = 0;
    return {
        spend() {
            calls += 1;
            if (calls > MAX_MODEL_CALLS_PER_TURN) throw new TurnBudgetExceededError(calls);
        },
    };
};

export { MAX_MODEL_CALLS_PER_TURN };
