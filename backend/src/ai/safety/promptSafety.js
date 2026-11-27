// Board text is untrusted once it reaches the model. No filter is a boundary; the boundaries are
// structural: system-only authority, strict output, the validated edit language, reduced capabilities.
import { randomBytes } from "crypto";
import { chatCompletion, resolveModelForRole } from "../model/provider.js";
import logger from "../../observability/logger.js";

const PROMPT_GUARD_THRESHOLD = 0.9;
const PROMPT_GUARD_TIMEOUT_MS = 2_000;
const MAX_SCANNED_CHARS = 4_000;

// These render as nothing to readers but are read by the model, so they can hide instructions.
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁯﻿\u{E0000}-\u{E007F}]/gu;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Emoji sequences and scripts like Hindi need these joiners, so beside anything but
// plain ASCII they aren't a sign of hidden text. They can't spell out an instruction.
const WRITING_JOINERS = /(?<=[^\x00-\x7F])[\u200C\u200D]|[\u200C\u200D](?=[^\x00-\x7F])/gu;

// What reaches the model is this cleaned text, never the original: screening a
// cleaned copy and forwarding the raw one would still deliver the hidden text.
export const normalizeUntrustedText = (text) => {
    const original = String(text ?? "");
    const normalized = original.normalize("NFKC");
    const cleaned = normalized.replace(INVISIBLE_CHARS, "").replace(CONTROL_CHARS, "");
    return { text: cleaned, hadHiddenChars: cleaned.length < normalized.replace(WRITING_JOINERS, "").length };
};

const LOOKALIKES = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", і: "i", е: "e", а: "a", о: "o", р: "p", с: "c" };

// Lowercased, lookalikes mapped and punctuation dropped, for matching only, so
// "1gn0re   previous-instructions" reads the same as the plain phrase.
const foldForMatching = (text) =>
    text
        .slice(0, MAX_SCANNED_CHARS)
        .toLowerCase()
        .replace(/[0134578@$іеаорс]/g, (char) => LOOKALIKES[char] ?? char)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ");

// Phrases, not single words: "delete" and "system" appear in ordinary requests.
const FOLDED_INJECTION_PATTERNS = [
    /\b(ignore|disregard|forget|override|bypass) (all |any |the |your |my |every |these |those )*(previous|prior|above|earlier|preceding|system|original|existing) ?(instructions?|prompts?|rules?|messages?|context|directions?|guidelines?)\b/,
    /\b(ignore|disregard|forget) (all |any |every |your )(instructions?|prompts?|rules?|guidelines?)\b/,
    /\b(forget|ignore) (everything|all) (above|before|prior|previous)\b/,
    /\byou are now\b/,
    /\bnew (system )?instructions? (are|follow|below)\b/,
    /\bact as (a |an )?(different|unrestricted|jailbroken|uncensored)\b/,
    /\b(reveal|show|print|repeat|output|leak|what is|what are) (me )?(your |the )?(system|initial|hidden|developer) (prompt|instructions?|message)\b/,
    /\b(do anything now|jailbreak|developer mode)\b/,
];

const RAW_INJECTION_PATTERNS = [/new (system )?instructions?\s*[:.]/i, /^\s*system\s*:/im, /<\/?(system|assistant|instructions?)>/i, /\[\/?(system|inst)\]/i];

// Loose by design: a match only removes capabilities from a turn.
export const scanForInjectionAttempt = (text) => {
    if (!text) return false;
    const folded = foldForMatching(text);
    return FOLDED_INJECTION_PATTERNS.some((pattern) => pattern.test(folded)) || RAW_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
};

// Matched as the model receives it, since hidden characters could split a phrase past the
// patterns, and hiding characters is suspicious in itself.
export const isSuspectBoardText = (rawText) => {
    const { text, hadHiddenChars } = normalizeUntrustedText(rawText);
    return hadHiddenChars || scanForInjectionAttempt(text);
};

// A classifier on its own quota. Fails open: it adds a signal, and its outage mustn't take the
// assistant down.
export const screenWithPromptGuard = async ({ apiKey, text, signal }) => {
    const timeoutSignal = AbortSignal.timeout(PROMPT_GUARD_TIMEOUT_MS);
    try {
        const raw = await chatCompletion({
            apiKey,
            model: resolveModelForRole("promptGuard"),
            responseFormat: null,
            messages: [{ role: "user", content: text.slice(0, MAX_SCANNED_CHARS) }],
            signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
        });
        const score = Number.parseFloat(raw);
        return { flagged: Number.isFinite(score) && score >= PROMPT_GUARD_THRESHOLD, score: Number.isFinite(score) ? score : null, available: true };
    } catch (error) {
        logger.warn({ errorCode: error.code ?? error.name }, "prompt guard unavailable, continuing without it");
        return { flagged: false, score: null, available: false };
    }
};

// A fresh value per turn, so board content cannot forge the closing marker of a
// block it was written before the marker existed.
export const createTurnSecrets = () => ({
    boundary: `board_data_${randomBytes(6).toString("hex")}`,
    canary: `MOSAIC-${randomBytes(6).toString("hex")}`,
});

const defangMarkers = (text) => text.replace(/board_data_[a-z0-9]*/gi, "board data");

// Spotlighting: fenced text is data per the system prompt, and models weigh it far less.
export const buildUntrustedDataMessage = (label, payload, boundary) => {
    const body = defangMarkers(typeof payload === "string" ? normalizeUntrustedText(payload).text : JSON.stringify(payload));
    return { role: "user", content: `${label}:\n<<${boundary}>>\n${body}\n<<end_${boundary}>>` };
};

const objectTexts = (object) => [object.name, object.fullText, object.text].filter(Boolean);

// Scans the attacker-controlled strings, not generated fields, returning refs to log and withhold.
export const scanSceneForInjectionAttempts = (groundedScene) =>
    groundedScene.objects.filter((object) => objectTexts(object).some(isSuspectBoardText)).map((object) => object.ref);
