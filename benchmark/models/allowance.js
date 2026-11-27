import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MINUTE_MS = 60_000;
const CHARS_PER_TOKEN = 4;

export class AllowanceUsedError extends Error {
    constructor(which) {
        super(`the free ${which} allowance is used up for today`);
        this.name = "AllowanceUsedError";
    }
}

export const estimateRequestTokens = (request) =>
    Math.ceil(request.messages.reduce((sum, message) => sum + String(message.content ?? "").length, 0) / CHARS_PER_TOKEN) + (request.max_tokens ?? 2_000);

// The day a provider's daily allowance belongs to, for one whose day starts at a given UTC hour.
const allowanceDay = (startHourUtc = 0, now = Date.now()) => new Date(now - startHourUtc * 3_600_000).toISOString().slice(0, 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Daily use survives between runs in the ledger file, so a run tomorrow resumes rather than starting over.
// Each write merges into the file as it is now, so runs for different providers can share it at the same time.
export const openLedger = (path) => {
    const readSaved = () => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
    const saved = readSaved();
    const entryFor = (key, day) => {
        saved[day] ??= {};
        saved[day][key] ??= { requests: 0, tokens: 0 };
        return saved[day][key];
    };
    return {
        usedToday: (key, day = allowanceDay()) => ({ ...entryFor(key, day) }),
        record: (key, tokens, day = allowanceDay()) => {
            const entry = entryFor(key, day);
            entry.requests += 1;
            entry.tokens += tokens;
            const latest = readSaved();
            latest[day] = { ...latest[day], [key]: entry };
            writeFileSync(path, `${JSON.stringify(latest, null, 2)}\n`);
        },
    };
};

// Paces one provider model under every published ceiling: requests and tokens a minute, and a day.
export const createAllowance = ({ key, limits, ledger, dayStartHourUtc = 0 }) => {
    const recent = [];
    const trim = (now) => {
        while (recent.length > 0 && now - recent[0].at >= MINUTE_MS) recent.shift();
    };
    const waitUntil = async (fits) => {
        for (;;) {
            const now = Date.now();
            trim(now);
            if (
                recent.length === 0 ||
                fits(
                    recent.length,
                    recent.reduce((sum, request) => sum + request.tokens, 0),
                )
            )
                return;
            await sleep(Math.max(250, MINUTE_MS - (now - recent[0].at)));
        }
    };
    return {
        key,
        // Waits until a whole task fits in the minute, so pacing never eats into the assistant's own turn deadline.
        roomFor: ({ requests, tokens }) =>
            waitUntil((count, used) => (!limits.rpm || count + requests <= limits.rpm) && (!limits.tpm || used + tokens <= limits.tpm)),
        async take(estimatedTokens) {
            const used = ledger.usedToday(key, allowanceDay(dayStartHourUtc));
            if (limits.rpd && used.requests >= limits.rpd) throw new AllowanceUsedError("request");
            if (limits.tpd && used.tokens + estimatedTokens > limits.tpd) throw new AllowanceUsedError("token");
            await waitUntil((count, used) => (!limits.rpm || count < limits.rpm) && (!limits.tpm || used + estimatedTokens <= limits.tpm));
            const entry = { at: Date.now(), tokens: estimatedTokens };
            recent.push(entry);
            return (actualTokens) => {
                entry.tokens = actualTokens;
                ledger.record(key, actualTokens, allowanceDay(dayStartHourUtc));
            };
        },
    };
};
