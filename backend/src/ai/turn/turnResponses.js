// What a turn tells the person: fixed failure wording, edit outcomes and the review card's fields.
import { ProviderError, PROVIDER_ERROR_CODES } from "../model/provider.js";

const PROVIDER_FAILURES = {
    [PROVIDER_ERROR_CODES.RATE_LIMITED]: { status: 429, message: "The assistant is at capacity right now." },
    [PROVIDER_ERROR_CODES.TOO_LARGE]: { status: 422, message: "This board is too large to read in one go. Select the objects you mean, then ask again." },
    [PROVIDER_ERROR_CODES.INVALID_OUTPUT]: { status: 422, message: "I couldn't produce a usable result for that. Try rewording it." },
    [PROVIDER_ERROR_CODES.UNAVAILABLE]: { status: 503, message: "The AI service isn't responding. Your board hasn't changed, so it's safe to try again." },
    [PROVIDER_ERROR_CODES.TIMEOUT]: { status: 503, message: "That took too long and was stopped. Your board hasn't changed, so it's safe to try again." },
    [PROVIDER_ERROR_CODES.AUTH]: { status: 503, message: "The assistant isn't available right now. This has been reported." },
    [PROVIDER_ERROR_CODES.BAD_REQUEST]: { status: 502, message: "Something went wrong talking to the AI service. Your board hasn't changed." },
};
export const PROVIDER_FAILURE_MESSAGE = PROVIDER_FAILURES[PROVIDER_ERROR_CODES.BAD_REQUEST].message;
const UNEXPECTED_FAILURE = { status: 500, message: "Something went wrong on our side. Your board hasn't changed." };
// Past this wait the free key's allowance for the day is spent, not just its per-minute share.
const ALLOWANCE_SPENT_SECONDS = 15 * 60;

export const plural = (count, unit) => `${count} ${unit}${count === 1 ? "" : "s"}`;
const describeWait = (seconds) => {
    if (seconds < 90) return plural(seconds, "second");
    if (seconds < 90 * 60) return plural(Math.round(seconds / 60), "minute");
    return plural(Math.round(seconds / 3600), "hour");
};

const retryMessage = (code, message, retryAfterSeconds) => {
    if (!retryAfterSeconds) return message;
    if (code === PROVIDER_ERROR_CODES.RATE_LIMITED && retryAfterSeconds >= ALLOWANCE_SPENT_SECONDS) {
        return `The assistant has used its free allowance for now. Try again in about ${describeWait(retryAfterSeconds)}.`;
    }
    return `${message} Try again in about ${describeWait(retryAfterSeconds)}.`;
};

// Only these fixed strings reach the client: a provider's own error text can carry a
// rejected generation, billing details and organisation ids.
export const describeTurnFailure = (error) => {
    if (!(error instanceof ProviderError)) return { ...UNEXPECTED_FAILURE, code: "unexpected" };
    const failure = PROVIDER_FAILURES[error.code] ?? PROVIDER_FAILURES[PROVIDER_ERROR_CODES.BAD_REQUEST];
    const retryAfterSeconds = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null;
    return {
        ...failure,
        code: error.code,
        retryAfterSeconds,
        message: retryMessage(error.code, failure.message, retryAfterSeconds),
    };
};

// Specific wording per failure, naming what the model attempted where known, so a miss is
// never disguised as something unrelated.
export const describeEditOutcome = (result) => {
    if (result.status === "unauthorized") return "You don't have edit access to make this change.";
    if (result.status === "conflict" || result.status === "needs-dependency") return result.message;
    if (result.status === "rejected") {
        const attempted = result.sanitizeEvents?.find((event) => event.type === "op-dropped" || event.type === "ref-dropped");
        if (attempted) return `I couldn't find a matching object on the board for that ${attempted.op}.`;
        return result.reason === "this preview has expired or was already resolved"
            ? "That preview has expired. Ask again and I'll redo it."
            : "I couldn't find anything on the board matching that.";
    }
    if (result.status === "needs-repair") return `That change isn't something I could safely apply: ${result.complaint}`;
    return "I couldn't turn that into a valid change to the board. Try rewording it.";
};

const HIGH_RISK_ELEMENT_COUNT = 25;

export const changedElementCount = ({ diff }) => diff.added.length + diff.removed.length + diff.moved.length + diff.modified.length;

// Low risk means no lint at any level, nothing the executor failed, nothing destructive and
// nothing sweeping. A turn shaped by suspicious text is never low risk.
export const isLowRiskPlan = (plan, { tainted }) =>
    !tainted &&
    plan.remainingLints.length === 0 &&
    plan.failedOps.length === 0 &&
    changedElementCount(plan) <= HIGH_RISK_ELEMENT_COUNT &&
    !plan.opsPreview.some((entry) => entry.op === "delete");

// What the review card shows, the same whether a plan is new or was just redone.
export const reviewFieldsOf = (plan) => ({
    token: plan.token,
    diff: plan.diff,
    opsPreview: plan.opsPreview,
    autoRepairs: plan.autoRepairs,
    lints: plan.remainingLints,
    skippedOps: plan.skippedOps,
    tainted: plan.tainted,
});
