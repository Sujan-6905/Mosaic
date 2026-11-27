#!/usr/bin/env node
// The assistant's diagram and drawing tasks on several models, through its first version and today's, inside each
// provider's free allowance; a run cut short by a daily limit resumes. Flags and setup: benchmark/README.md.
import "./bootstrap.js";
import "./backendEnv.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { requireFromMcpServer } from "./packageResolution.js";
import { provideDagre } from "../shared/canvas/layoutEngine.js";
import { renderBoardSvg } from "../backend/src/ai/eval/boardSvg.js";
import { PROVIDERS, modelLabel, parseModelList } from "./models/providers.js";
import { createAllowance, openLedger } from "./models/allowance.js";
import { installTransport } from "./models/transport.js";
import { TASKS } from "./models/tasks.js";
import { VARIANTS } from "./models/variants.js";
import { gradeResult } from "./models/grade.js";
import { formatModelReport } from "./models/report.js";

provideDagre(requireFromMcpServer("dagre"));
// Free-tier pacing waits inside a turn, so the product's deadlines would fail tasks for reasons that aren't the model's.
// A provider that generates slowly raises them further; a value set in the environment wins over both.
const DEADLINES = { callTimeoutMs: 240_000, turnDeadlineMs: 1_800_000 };
const deadlineOverrides = { callTimeoutMs: process.env.AI_CALL_TIMEOUT_MS, turnDeadlineMs: process.env.AI_TURN_DEADLINE_MS };
const applyDeadlines = (provider) => {
    const deadline = (name) => deadlineOverrides[name] ?? String(provider.deadlines?.[name] ?? DEADLINES[name]);
    process.env.AI_CALL_TIMEOUT_MS = deadline("callTimeoutMs");
    process.env.AI_TURN_DEADLINE_MS = deadline("turnDeadlineMs");
};

const RESULTS_DIR = new URL("./results/models/", import.meta.url).pathname;
// Rough per-task cost from the assistant's traces (a decision about 2,000 tokens, a sketch about 5,000, a style choice
// about 2,500), so the plan can tell whether a run fits in a day of free allowance.
const MAX_UNANSWERED_IN_A_ROW = 3;
const COST_PER_TASK = { baseline: { calls: 1.2, tokens: 1_500 }, mosaic: { calls: 2.2, tokens: 7_000 } };

const argValue = (flag, fallback) => {
    const index = process.argv.indexOf(flag);
    return index === -1 ? fallback : process.argv[index + 1];
};

const chosenTasks = (value) =>
    value === "diagram" || value === "drawing" ? TASKS.filter((task) => task.kind === value) : TASKS.filter((task) => value.split(",").includes(task.id));

const limitOverrides = (value) =>
    Object.fromEntries(
        value
            .split(",")
            .filter(Boolean)
            .map((entry) => {
                const [provider, setting] = entry.split(":");
                const [name, amount] = setting.split("=");
                return [`${provider}.${name}`, Number(amount)];
            }),
    );

const slug = (text) => text.replace(/[^a-z0-9.-]+/gi, "-");

// A provider that never answered, or answered too late for the call's deadline, says nothing about the model.
const PROVIDER_FAILURES = new Set(["unavailable", "timeout"]);
const wentUnanswered = (result, callsBefore, callsAfter) => PROVIDER_FAILURES.has(result.error) || (result.outcome === "error" && callsAfter === callsBefore);

const available = (provider) => {
    if (!provider.command) return Boolean(process.env[provider.keyEnv]);
    try {
        execFileSync(provider.command, ["--version"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
};

const models = parseModelList(argValue("--models", Object.keys(PROVIDERS).join(",")));
const variantIds = argValue("--variants", Object.keys(VARIANTS).join(",")).split(",");
const tasks = argValue("--tasks", null) ? chosenTasks(argValue("--tasks")) : TASKS;
const overrides = limitOverrides(argValue("--limits", ""));
const limitsOf = (providerId, model) =>
    Object.fromEntries(
        Object.entries({ ...PROVIDERS[providerId].limits, ...PROVIDERS[providerId].modelLimits?.[model] }).map(([name, value]) => [
            name,
            overrides[`${providerId}.${name}`] ?? value,
        ]),
    );

if (process.argv.includes("--plan")) {
    console.log(`${tasks.length} tasks x ${variantIds.length} versions per model\n`);
    for (const { provider, model } of models) {
        const limits = limitsOf(provider, model);
        const calls = tasks.length * variantIds.reduce((sum, variant) => sum + COST_PER_TASK[variant].calls, 0);
        const tokens = tasks.length * variantIds.reduce((sum, variant) => sum + COST_PER_TASK[variant].tokens, 0);
        const days = Math.max(limits.rpd ? calls / limits.rpd : 0, limits.tpd ? tokens / limits.tpd : 0);
        const minutes = Math.max(limits.rpm ? calls / limits.rpm : 0, limits.tpm ? tokens / limits.tpm : 0);
        console.log(
            `${provider}:${model}  ~${Math.ceil(calls)} calls, ~${Math.round(tokens / 1000)}k tokens, at least ${Math.ceil(minutes)} min${days > 1 ? `, ${Math.ceil(days)} days of free allowance` : ""}${available(PROVIDERS[provider]) ? "" : `  (no ${PROVIDERS[provider].keyEnv ?? `${PROVIDERS[provider].command} CLI`})`}`,
        );
    }
    process.exit(0);
}

mkdirSync(RESULTS_DIR, { recursive: true });
const ledger = openLedger(join(RESULTS_DIR, "ledger.json"));

for (const { provider: providerId, model } of models) {
    const provider = PROVIDERS[providerId];
    const modelKey = `${providerId}:${model}`;
    if (!available(provider)) {
        console.log(`\n${modelKey}: skipped, ${provider.keyEnv ? `${provider.keyEnv} is not set` : `the ${provider.command} CLI is not installed`}`);
        continue;
    }
    applyDeadlines(provider);
    const dir = join(RESULTS_DIR, slug(modelKey));
    mkdirSync(dir, { recursive: true });
    const allowance = createAllowance({ key: modelKey, limits: limitsOf(providerId, model), ledger, dayStartHourUtc: provider.dayStartHourUtc });
    const usage = { calls: 0, inputTokens: 0, outputTokens: 0, modelMs: 0, rateLimitWaits: 0, allowanceUsed: null };
    const uninstall = installTransport({ provider, model, allowance, apiKey: process.env[provider.keyEnv] ?? provider.transport, usage });
    console.log(`\n${modelKey}`);
    let unanswered = 0;
    try {
        run: for (const task of tasks)
            for (const variant of variantIds) {
                const name = `${task.id}.${variant}`;
                if (existsSync(join(dir, `${name}.json`)) && !process.argv.includes("--fresh")) continue;
                await allowance.roomFor({ requests: Math.ceil(COST_PER_TASK[variant].calls), tokens: COST_PER_TASK[variant].tokens });
                // A provider that admits requests as demand allows gets the same task again after a wait; only
                // the attempt that is kept counts towards the model's usage.
                const attempts = provider.retryUnanswered?.attempts ?? 1;
                let before;
                let result;
                for (let tries = 1; ; tries += 1) {
                    before = { ...usage };
                    result = await VARIANTS[variant]
                        .run({ task, apiKey: process.env[provider.keyEnv] ?? provider.transport })
                        .catch((error) => ({ outcome: "error", error: error.code ?? error.message, elements: {} }));
                    if (!wentUnanswered(result, before.calls, usage.calls) || tries >= attempts || usage.allowanceUsed) break;
                    console.log(`  ${name.padEnd(28)} not answered (${result.error}), trying again (${tries} of ${attempts})`);
                    await new Promise((resolve) => setTimeout(resolve, provider.retryUnanswered.waitMs));
                }
                // A task cut short by the allowance, a rate limit, an outage or a refused key says nothing about the model, so it isn't kept.
                if (usage.allowanceUsed) {
                    console.log(`  stopped: ${usage.allowanceUsed}; run again tomorrow to continue`);
                    break run;
                }
                if (result.error === "rate_limited") {
                    console.log("  stopped: the provider is still rate limiting after retries; run again later to continue");
                    break run;
                }
                if (wentUnanswered(result, before.calls, usage.calls)) {
                    console.log(`  ${name.padEnd(28)} skipped: the model never answered (${result.error}); the next run tries it again`);
                    // An overloaded provider would spend a small daily allowance on refusals, so it is left for later.
                    unanswered += 1;
                    if (unanswered >= MAX_UNANSWERED_IN_A_ROW) {
                        console.log(`  stopped: ${unanswered} tasks in a row went unanswered; run again later to continue`);
                        break run;
                    }
                    continue;
                }
                unanswered = 0;
                if (result.error === "auth") {
                    console.log("  stopped: the provider refused the key");
                    break run;
                }
                const record = {
                    modelKey,
                    task: task.id,
                    kind: task.kind,
                    variant,
                    outcome: result.outcome,
                    error: result.error ?? null,
                    recipe: result.recipe ?? null,
                    parts: result.parts ?? null,
                    usage: {
                        calls: usage.calls - before.calls,
                        inputTokens: usage.inputTokens - before.inputTokens,
                        outputTokens: usage.outputTokens - before.outputTokens,
                        modelMs: usage.modelMs - before.modelMs,
                        rateLimitWaits: usage.rateLimitWaits - before.rateLimitWaits,
                    },
                    grade: gradeResult(task, result),
                    image: `models/${slug(modelKey)}/${name}.svg`,
                    ranAt: new Date().toISOString(),
                };
                writeFileSync(join(dir, `${name}.svg`), renderBoardSvg(result.elements));
                writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
                console.log(
                    `  ${name.padEnd(28)} ${record.outcome}${record.error ? ` (${record.error})` : ""}, ${record.grade.elementCount} elements, coverage ${record.grade.coverage === null ? "n/a" : Math.round(record.grade.coverage * 100) + "%"}, ${record.usage.calls} calls`,
                );
            }
    } finally {
        uninstall();
    }
}

const results = readdirSync(RESULTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
        readdirSync(join(RESULTS_DIR, entry.name))
            .filter((file) => file.endsWith(".json"))
            .map((file) => JSON.parse(readFileSync(join(RESULTS_DIR, entry.name, file), "utf8"))),
    );
// A model reached some other way than its provider's own API says so on every row and in a note.
const providersInResults = [...new Set(results.map((result) => result.modelKey.split(":")[0]))].map((id) => PROVIDERS[id]).filter(Boolean);
const labels = new Map(results.map(({ modelKey }) => [modelKey, modelLabel(modelKey)]));
writeFileSync(
    new URL("./results/model-benchmark.md", import.meta.url).pathname,
    formatModelReport({ results, variants: VARIANTS, tasks: TASKS, labels, notes: providersInResults.map((provider) => provider.note).filter(Boolean) }),
);
console.log(`\n${results.length} results; report in benchmark/results/model-benchmark.md`);
