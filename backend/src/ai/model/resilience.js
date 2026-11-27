// Retries, fallback models and a circuit breaker within the turn's deadline. Only failures that
// could succeed unchanged are retried; a 400 or 413 never will.
import { ProviderError, PROVIDER_ERROR_CODES } from "./provider.js";

const ATTEMPTS_PER_MODEL = 2;
const CALL_TIMEOUT_MS = 20_000;
const callTimeoutMs = () => Number(process.env.AI_CALL_TIMEOUT_MS) || CALL_TIMEOUT_MS;
const BASE_BACKOFF_MS = 400;
// A wait longer than this reads as a hang in a chat UI, so the turn moves on
// to the fallback model instead of honouring the full retry-after.
const MAX_RETRY_WAIT_MS = 6_000;
const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 30_000;

const RETRYABLE_CODES = new Set([PROVIDER_ERROR_CODES.RATE_LIMITED, PROVIDER_ERROR_CODES.UNAVAILABLE, PROVIDER_ERROR_CODES.TIMEOUT]);
// A model that couldn't produce valid output, or that rejects a request, may well
// do the same again, but another model is a genuinely different attempt.
const NEXT_MODEL_CODES = new Set([PROVIDER_ERROR_CODES.INVALID_OUTPUT, PROVIDER_ERROR_CODES.BAD_REQUEST]);
// A rate limit means the provider is healthy and saying no, so it must not
// open the breaker: only real outages count toward it.
const BREAKER_CODES = new Set([PROVIDER_ERROR_CODES.UNAVAILABLE, PROVIDER_ERROR_CODES.TIMEOUT]);

const breakers = new Map();

const breakerFor = (model) => {
    if (!breakers.has(model)) breakers.set(model, { failures: 0, openUntil: 0 });
    return breakers.get(model);
};

const recordOutcome = (model, error) => {
    const breaker = breakerFor(model);
    if (!error) {
        breaker.failures = 0;
        breaker.openUntil = 0;
        return;
    }
    if (!BREAKER_CODES.has(error.code)) return;
    breaker.failures += 1;
    if (breaker.failures >= BREAKER_FAILURE_THRESHOLD) breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
};

export const openBreakers = () => [...breakers].filter(([, breaker]) => breaker.openUntil > Date.now()).map(([model]) => model);

export const resetBreakersForTests = () => breakers.clear();

const abortableSleep = (ms, signal) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            },
            { once: true },
        );
    });

const retryWaitMs = (error, attempt) => {
    const backoff = BASE_BACKOFF_MS * 2 ** attempt;
    const jitter = Math.random() * BASE_BACKOFF_MS;
    return (error.retryAfterMs ?? backoff) + jitter;
};

// `call(model, signal)` performs one attempt. Calls `onAttempt` per attempt so
// the turn's trace sees each retry and fallback rather than one merged span.
export const callWithResilience = async ({ models, call, deadlineAt, signal, onAttempt = () => {}, maxRetryWaitMs = MAX_RETRY_WAIT_MS }) => {
    let lastError = null;

    for (const model of models) {
        if (breakerFor(model).openUntil > Date.now()) {
            onAttempt({ model, skipped: "breaker-open" });
            continue;
        }

        for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt += 1) {
            const remainingMs = deadlineAt - Date.now();
            if (remainingMs <= 0) throw lastError ?? new ProviderError({ code: PROVIDER_ERROR_CODES.TIMEOUT });

            const timeoutSignal = AbortSignal.timeout(Math.min(callTimeoutMs(), remainingMs));
            const attemptSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
            const startedAt = Date.now();

            try {
                const result = await call(model, attemptSignal);
                recordOutcome(model, null);
                onAttempt({ model, attempt, durationMs: Date.now() - startedAt, result });
                return result;
            } catch (rawError) {
                if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
                const timedOut = rawError.name === "TimeoutError" || rawError.name === "AbortError";
                const error =
                    rawError instanceof ProviderError
                        ? rawError
                        : new ProviderError({ code: timedOut ? PROVIDER_ERROR_CODES.TIMEOUT : PROVIDER_ERROR_CODES.UNAVAILABLE, model });
                recordOutcome(model, error);
                onAttempt({ model, attempt, durationMs: Date.now() - startedAt, error });
                if (NEXT_MODEL_CODES.has(error.code)) {
                    lastError = error;
                    break;
                }
                if (!RETRYABLE_CODES.has(error.code)) throw error;
                lastError = error;

                const waitMs = retryWaitMs(error, attempt);
                const canRetry = attempt + 1 < ATTEMPTS_PER_MODEL && waitMs <= maxRetryWaitMs && Date.now() + waitMs < deadlineAt;
                if (!canRetry) break;
                await abortableSleep(waitMs, signal);
            }
        }
    }

    throw lastError ?? new ProviderError({ code: PROVIDER_ERROR_CODES.UNAVAILABLE });
};
