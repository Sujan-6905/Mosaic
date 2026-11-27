// String checks on everything the model wrote, assuming it may have been subverted: the prompt
// coming back out, credentials and code. The strict schema does the structural work.
const MAX_REPLY_CHARS = 1_200;

const SECRET_PATTERNS = [
    /\bgsk_[A-Za-z0-9]{16,}/,
    /\bsk-[A-Za-z0-9]{16,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];

const PROMPT_LEAK_PATTERNS = [/\byou are mosaic'?s\b/i, /\bhard rules\b/i, /board_data_[a-z0-9]{6,}/i];

// The assistant explains a board in plain sentences, so a code block in a reply
// means the model was steered off its job.
const CODE_PATTERNS = [
    /```/,
    /#include\s*</,
    /\bpublic\s+(class|static)\b/,
    /\bdef\s+\w+\s*\(.*\)\s*:/,
    /\bfunction\s+\w+\s*\(/,
    /\bvector<\w+>/,
    /\bconsole\.log\(/,
];

// A rendered image or link is a known way to smuggle data out through a URL.
const MARKDOWN_MEDIA = /!?\[([^\]]*)\]\([^)]*\)/g;
const BARE_URL = /\bhttps?:\/\/\S+/gi;

export const OUTPUT_BLOCK_REASONS = { CANARY: "canary", SECRET: "secret", PROMPT_LEAK: "prompt-leak", CODE: "code" };

const blockReasonFor = (text, canary) => {
    if (canary && text.includes(canary)) return OUTPUT_BLOCK_REASONS.CANARY;
    if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) return OUTPUT_BLOCK_REASONS.SECRET;
    if (PROMPT_LEAK_PATTERNS.some((pattern) => pattern.test(text))) return OUTPUT_BLOCK_REASONS.PROMPT_LEAK;
    return null;
};

const clipAtSentence = (text) => {
    if (text.length <= MAX_REPLY_CHARS) return text;
    const clipped = text.slice(0, MAX_REPLY_CHARS);
    const lastStop = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf(".\n"));
    return lastStop > MAX_REPLY_CHARS / 2 ? clipped.slice(0, lastStop + 1) : `${clipped.trimEnd()}…`;
};

// Conversational text the user reads. Returns { blocked: reason } or { text }.
export const inspectReply = (rawText, { canary } = {}) => {
    const text = String(rawText ?? "").trim();
    const reason = blockReasonFor(text, canary) ?? (CODE_PATTERNS.some((pattern) => pattern.test(text)) ? OUTPUT_BLOCK_REASONS.CODE : null);
    if (reason) return { blocked: reason };
    return {
        text: clipAtSentence(
            text
                .replace(MARKDOWN_MEDIA, "$1")
                .replace(BARE_URL, "")
                .replace(/[ \t]{2,}/g, " ")
                .trim(),
        ),
    };
};

// Board text may quote code, but never a secret or the prompt.
export const inspectBoardText = (strings, { canary } = {}) => {
    for (const value of strings) {
        const reason = blockReasonFor(String(value ?? ""), canary);
        if (reason) return { blocked: reason };
    }
    return {};
};
