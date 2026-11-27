// The OpenAI-compatible chat-completions API, so changing provider is a URL and model change.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const PROVIDER_NAME = "groq";

// Callers ask for a role, not a model id. `fallback` lists models, each on its own Groq quota with
// strict structured outputs, that serve `reasoning` when it is limited or down.
const DEFAULT_MODELS = {
    reasoning: "qwen/qwen3.8-27b",
    fallback: "openai/gpt-oss-20b,openai/gpt-oss-120b",
    promptGuard: "meta-llama/llama-prompt-guard-2-86m",
    // Choosing a diagram's style reads a long catalogue, so it runs on a model
    // with its own quota instead of spending the primary's.
    stylist: "openai/gpt-oss-20b",
};

const ROLE_ENV_VARS = {
    reasoning: "AI_MODEL_REASONING",
    fallback: "AI_MODEL_FALLBACK",
    promptGuard: "AI_MODEL_PROMPT_GUARD",
    stylist: "AI_MODEL_STYLIST",
};

// `env` is a parameter so a test can resolve against an arbitrary snapshot.
const resolveModelForRole = (role, env = process.env) => {
    const envVar = ROLE_ENV_VARS[role];
    if (!envVar) throw new Error(`Unknown AI model role "${role}"`);
    return env[envVar] || DEFAULT_MODELS[role];
};

export const PROVIDER_ERROR_CODES = {
    RATE_LIMITED: "rate_limited",
    TOO_LARGE: "too_large",
    INVALID_OUTPUT: "invalid_output",
    UNAVAILABLE: "unavailable",
    TIMEOUT: "timeout",
    AUTH: "auth",
    BAD_REQUEST: "bad_request",
};

const parseRetryAfterMs = (headers) => {
    const seconds = Number(headers?.get?.("retry-after"));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
};

// The body is left out: it can echo the rejected generation and name the organisation and billing tier.
export class ProviderError extends Error {
    constructor({ code, status = null, providerCode = null, retryAfterMs = null, model = null }) {
        super(`AI provider error: ${code}${status ? ` (${status})` : ""}`);
        this.name = "ProviderError";
        this.code = code;
        this.status = status;
        this.providerCode = providerCode;
        this.retryAfterMs = retryAfterMs;
        this.model = model;
    }
}

const providerCodeFrom = (body) => {
    try {
        return JSON.parse(body)?.error?.code ?? null;
    } catch {
        return null;
    }
};

const codeForFailure = (status, providerCode) => {
    if (providerCode === "json_validate_failed") return PROVIDER_ERROR_CODES.INVALID_OUTPUT;
    if (status === 413 || providerCode === "context_length_exceeded") return PROVIDER_ERROR_CODES.TOO_LARGE;
    if (status === 429) return PROVIDER_ERROR_CODES.RATE_LIMITED;
    if (status === 401 || status === 403) return PROVIDER_ERROR_CODES.AUTH;
    if (status === 498 || status >= 500) return PROVIDER_ERROR_CODES.UNAVAILABLE;
    return PROVIDER_ERROR_CODES.BAD_REQUEST;
};

const toResponseFormat = (responseFormat, responseSchema) => {
    if (responseSchema) return { type: "json_schema", json_schema: { name: responseSchema.name, strict: true, schema: responseSchema.schema } };
    return responseFormat ? { type: responseFormat } : null;
};

// `model` overrides the role's model. `responseSchema` ({ name, schema }) constrains decoding;
// the default JSON mode only guarantees syntax.
const modelCompletion = async ({
    apiKey,
    model,
    role = "reasoning",
    messages,
    responseFormat = "json_object",
    responseSchema = null,
    maxTokens,
    temperature,
    signal,
}) => {
    const resolvedModel = model ?? resolveModelForRole(role);
    const format = toResponseFormat(responseFormat, responseSchema);
    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: resolvedModel,
            messages,
            ...(format ? { response_format: format } : {}),
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
            ...(temperature !== undefined ? { temperature } : {}),
        }),
        signal,
    });

    if (!response.ok) {
        const providerCode = providerCodeFrom(await response.text());
        throw new ProviderError({
            code: codeForFailure(response.status, providerCode),
            status: response.status,
            providerCode,
            retryAfterMs: parseRetryAfterMs(response.headers),
            model: resolvedModel,
        });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    return {
        content: choice?.message?.content,
        finishReason: choice?.finish_reason ?? null,
        model: data.model ?? resolvedModel,
        responseId: data.id ?? null,
        usage: data.usage ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens } : null,
    };
};

const chatCompletion = async (params) => (await modelCompletion(params)).content;

export { chatCompletion, modelCompletion, resolveModelForRole, DEFAULT_MODELS, PROVIDER_NAME };
