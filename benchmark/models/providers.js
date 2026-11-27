// Free-tier ceilings as each provider publishes them (rpm requests a minute, tpm tokens a minute, rpd and tpd a
// day). They change; check each provider's limits page before a run and override with --limits when they do.
export const PROVIDERS = {
    groq: {
        label: "Groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        keyEnv: "GROQ_API_KEY",
        limits: { rpm: 30, tpm: 8_000, rpd: 1_000, tpd: 200_000 },
        models: ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    },
    gemini: {
        label: "Google Gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        keyEnv: "GEMINI_API_KEY",
        limits: { rpm: 5, tpm: 250_000, rpd: 20 },
        // Flash Lite is allowed far more than the Flash models; the allowance day starts at midnight Pacific.
        modelLimits: { "gemini-3.5-flash-lite": { rpm: 15, rpd: 500 } },
        dayStartHourUtc: 8,
        models: ["gemini-3.5-flash-lite"],
        // Its OpenAI-compatible endpoint keeps only the last system message and drops the rest unread.
        singleSystemMessage: true,
    },
    nvidia: {
        label: "NVIDIA NIM",
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        keyEnv: "NVIDIA_API_KEY",
        limits: { rpm: 40 },
        models: ["mistralai/mistral-large-4-1t-a52b", "nvidia/nemotron-3-ultra-550b-a55b"],
        // NIM accepts JSON mode on most models but strict schemas on few.
        jsonSchema: false,
        // Its free tier queues requests and lets them through as demand allows, so a dropped one is tried again.
        retryUnanswered: { attempts: 10, waitMs: 30_000 },
        // Mistral Large 4 writes about two tokens a second here, so one long answer can take twenty minutes.
        deadlines: { callTimeoutMs: 2_700_000, turnDeadlineMs: 10_800_000 },
    },
    openrouter: {
        label: "OpenRouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        keyEnv: "OPENROUTER_API_KEY",
        // The 50 free requests a day are shared by every free model on the account, so one model fits in a day.
        limits: { rpm: 20, rpd: 50 },
        models: ["baidu/ernie-5.5-flash-preview:free"],
        jsonSchema: false,
    },
    antigravity: {
        label: "Gemini through Antigravity (Gemini subscription)",
        transport: "antigravity-cli",
        command: "agy",
        tag: "Antigravity",
        // Not the Gemini API: the CLI wraps every call in its own agent instructions, so its token counts
        // run about 10,000 a call higher and are not comparable with the API's.
        note: "Antigravity rows are Gemini models called through Google's Antigravity CLI on a Gemini subscription, not the Gemini API. The CLI wraps every call in its own agent instructions, about 10,000 tokens a call, so their token counts are not comparable with the other rows.",
        limits: { rpm: 4 },
        models: ["gemini-3.8-flash-medium"],
    },
    claude: {
        label: "Claude (Claude Code subscription)",
        transport: "claude-cli",
        command: "claude",
        // A subscription has no published per-minute ceiling; pacing keeps a run from using up the plan's window.
        limits: { rpm: 4 },
        models: ["haiku", "sonnet", "opus"],
    },
};

export const parseModelList = (value) =>
    value
        .split(",")
        .filter(Boolean)
        .map((entry) => {
            const [provider, ...model] = entry.split(":");
            if (!PROVIDERS[provider]) throw new Error(`Unknown provider "${provider}"; choose from ${Object.keys(PROVIDERS).join(", ")}`);
            return { provider, model: model.join(":") || null };
        })
        .flatMap(({ provider, model }) => (model ? [{ provider, model }] : PROVIDERS[provider].models.map((name) => ({ provider, model: name }))));

// A model's name in reports, marked when it was reached through something other than its provider's own API.
export const modelLabel = (modelKey) => {
    const tag = PROVIDERS[modelKey.split(":")[0]]?.tag;
    return tag ? `${modelKey} (${tag})` : modelKey;
};
