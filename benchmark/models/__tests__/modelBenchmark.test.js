import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeResult } from "../grade.js";
import { parseModelList, PROVIDERS } from "../providers.js";
import { AllowanceUsedError, createAllowance, openLedger } from "../allowance.js";
import { installTransport } from "../transport.js";
import { VARIANTS } from "../variants.js";
import { TASKS } from "../tasks.js";
import { formatModelReport } from "../report.js";

const box = (text, x, y) => ({
    type: "shape",
    shapeType: "Rectangle",
    startX: x,
    startY: y,
    endX: x + 100,
    endY: y + 40,
    text,
    color: "#000000",
    size: 2,
    zIndex: 1,
});
const memoryLedger = (used = { requests: 0, tokens: 0 }) => ({ usedToday: () => used, record: vi.fn() });

describe("gradeResult", () => {
    it("counts expected labels, overlapping boxes and arrows", () => {
        const task = { kind: "diagram", expect: ["client", "redis", "kafka"] };
        const elements = { a: box("Web client", 0, 0), b: box("Redis cache", 50, 10), c: { type: "connector", startX: 0, startY: 0, endX: 50, endY: 10 } };
        const grade = gradeResult(task, { outcome: "drawn", elements });
        expect(grade.coverage).toBeCloseTo(2 / 3);
        expect(grade.missing).toEqual(["kafka"]);
        expect(grade.overlappingLabels).toBe(1);
        expect(grade.connectors).toBe(1);
    });

    it("leaves coverage out for drawings", () => {
        expect(gradeResult({ kind: "drawing" }, { outcome: "invalid", elements: {} })).toMatchObject({ drawn: false, coverage: null, validShare: 0 });
    });
});

describe("parseModelList", () => {
    it("expands a provider to its default models and keeps a named one", () => {
        expect(parseModelList("claude,groq:openai/gpt-oss-20b")).toEqual([
            ...PROVIDERS.claude.models.map((model) => ({ provider: "claude", model })),
            { provider: "groq", model: "openai/gpt-oss-20b" },
        ]);
    });

    it("keeps colons inside a model id", () => {
        expect(parseModelList("openrouter:meta-llama/llama-3.3-70b-instruct:free")).toEqual([
            { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
        ]);
    });

    it("rejects an unknown provider", () => {
        expect(() => parseModelList("acme")).toThrow(/Unknown provider/);
    });
});

describe("createAllowance", () => {
    afterEach(() => vi.useRealTimers());

    it("stops once the day's requests are spent", async () => {
        const allowance = createAllowance({ key: "m", limits: { rpd: 5 }, ledger: memoryLedger({ requests: 5, tokens: 0 }) });
        await expect(allowance.take(100)).rejects.toBeInstanceOf(AllowanceUsedError);
    });

    it("waits for the next minute when the per-minute requests are used", async () => {
        vi.useFakeTimers();
        const allowance = createAllowance({ key: "m", limits: { rpm: 1 }, ledger: memoryLedger() });
        (await allowance.take(10))(10);
        let second = false;
        allowance.take(10).then(() => (second = true));
        await vi.advanceTimersByTimeAsync(30_000);
        expect(second).toBe(false);
        await vi.advanceTimersByTimeAsync(31_000);
        expect(second).toBe(true);
    });
});

describe("openLedger", () => {
    it("keeps the counts of two runs writing the same file", () => {
        const path = join(mkdtempSync(join(tmpdir(), "ledger-")), "ledger.json");
        const groq = openLedger(path);
        const gemini = openLedger(path);
        groq.record("groq:a", 100);
        gemini.record("gemini:b", 50);
        groq.record("groq:a", 20);
        const [day] = Object.values(JSON.parse(readFileSync(path, "utf8")));
        expect(day).toEqual({ "groq:a": { requests: 2, tokens: 120 }, "gemini:b": { requests: 1, tokens: 50 } });
    });
});

describe("installTransport", () => {
    const sent = [];
    const freeAllowance = { take: async () => () => {} };
    afterEach(() => vi.unstubAllGlobals());

    const send = async (provider, messages) => {
        vi.stubGlobal("fetch", async (url, init) => {
            sent.push(JSON.parse(init.body));
            return new Response(JSON.stringify({ choices: [], usage: {} }), { status: 200 });
        });
        const uninstall = installTransport({
            provider,
            model: "m",
            allowance: freeAllowance,
            apiKey: "k",
            usage: { calls: 0, inputTokens: 0, outputTokens: 0, modelMs: 0 },
        });
        await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", body: JSON.stringify({ messages }) });
        uninstall();
        return sent.at(-1).messages;
    };
    const messages = [
        { role: "system", content: "rules" },
        { role: "system", content: "context" },
        { role: "user", content: "draw" },
    ];

    it("joins the system messages for a provider that reads only one", async () => {
        expect(await send({ url: "https://example.test", singleSystemMessage: true }, messages)).toEqual([
            { role: "system", content: "rules\n\ncontext" },
            { role: "user", content: "draw" },
        ]);
    });

    it("passes the messages through unchanged otherwise", async () => {
        expect(await send({ url: "https://example.test" }, messages)).toEqual(messages);
    });
});

describe("the first version", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("places a well-formed answer as elements the board accepts", async () => {
        const answer = {
            elements: [
                { kind: "box", x: 100, y: 100, w: 160, h: 60, text: "Web client" },
                { kind: "arrow", x: 180, y: 160, x2: 180, y2: 240 },
                { kind: "label", x: 100, y: 40, text: "URL shortener" },
            ],
        };
        vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 }));
        const task = TASKS.find((candidate) => candidate.kind === "diagram");
        const result = await VARIANTS.baseline.run({ task, apiKey: "k" });
        expect(result.outcome).toBe("drawn");
        expect(gradeResult(task, result).validShare).toBe(1);
    });
});

describe("formatModelReport", () => {
    it("names a model on its first row even when the first version has no results yet", () => {
        const task = TASKS[0];
        const result = {
            modelKey: "acme:m",
            task: task.id,
            kind: task.kind,
            variant: "mosaic",
            outcome: "drawn",
            usage: { inputTokens: 10, outputTokens: 5, modelMs: 1000 },
            grade: gradeResult(task, { outcome: "drawn", elements: {} }),
            image: "models/acme-m/x.svg",
        };
        expect(formatModelReport({ results: [result], variants: VARIANTS, tasks: [task] })).toContain(`| acme:m | ${VARIANTS.mosaic.label} |`);
    });

    it("labels a model reached through a CLI and explains the route in a note", () => {
        const task = TASKS[0];
        const result = {
            modelKey: "antigravity:m",
            task: task.id,
            kind: task.kind,
            variant: "mosaic",
            outcome: "drawn",
            usage: { inputTokens: 10, outputTokens: 5, modelMs: 1000 },
            grade: gradeResult(task, { outcome: "drawn", elements: {} }),
            image: "models/antigravity-m/x.svg",
        };
        const report = formatModelReport({
            results: [result],
            variants: VARIANTS,
            tasks: [task],
            labels: new Map([["antigravity:m", "antigravity:m (Antigravity)"]]),
            notes: [PROVIDERS.antigravity.note],
        });
        expect(report).toContain("| antigravity:m (Antigravity) |");
        expect(report).toContain("not the Gemini API");
    });
});
