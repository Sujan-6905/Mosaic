#!/usr/bin/env node
// Runs every case through the real grounding and assistant pipeline. Without GROQ_API_KEY only
// resolution accuracy is measured. Usage: node benchmark/runBenchmark.js [--flags a,b] [--category c]
import "./bootstrap.js";
import { writeFileSync } from "node:fs";
import { EDIT_BENCHMARK_CASES } from "./editBenchmark/dataset.js";
import { BOARDS_BY_NAME } from "./editBenchmark/boards.js";
import { gradeCase } from "./editBenchmark/grade.js";
import { summarizeResults, formatSummaryTable } from "./editBenchmark/metrics.js";
import { buildGroundedScene } from "../backend/src/grounding/buildGroundedScene.js";
import { resolveReference } from "../backend/src/grounding/referenceResolver.js";
import { serializeSceneContext } from "../backend/src/grounding/contextSerializer.js";
import { chatCompletion } from "../backend/src/ai/model/provider.js";
import { AGENT_RESPONSE_SCHEMA, INTENTS, parseAgentResponse } from "../backend/src/ai/turn/agentContract.js";
import { buildMessages } from "../backend/src/ai/turn/agentTurn.js";
import { createTurnSecrets } from "../backend/src/ai/safety/promptSafety.js";
import { planEditOffline } from "./editBenchmark/pipeline.js";

const DEFAULT_DELAY_MS = 3000;
const MAX_RATE_LIMIT_RETRIES = 3;

const argValue = (argv, flag, fallback) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Groq's "try again in X" hint, when present, beats a guessed backoff.
const parseRetryAfterMs = (message) => {
    const match = message.match(/try again in ([\d.]+)(ms|s)/i);
    if (!match) return null;
    return match[2].toLowerCase() === "s" ? Number(match[1]) * 1000 : Number(match[1]);
};

// Retries only rate limits; any other failure is recorded as that case's error.
const chatCompletionWithBackoff = async (params) => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await chatCompletion(params);
        } catch (error) {
            const isRateLimited = error.message.includes("(429)");
            if (!isRateLimited || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
            await sleep((parseRetryAfterMs(error.message) ?? 2000 * (attempt + 1)) + 250);
        }
    }
};

// The assistant's own outcome, in the statuses grade.js scores; only an edit reaches the pipeline.
const pipelineResultFor = (outcome, board, groundedScene) => {
    if (outcome.type === INTENTS.EDIT) return planEditOffline(board.elements, groundedScene.objects, { ops: outcome.ops });
    if (outcome.type === INTENTS.CLARIFY) return { status: "ambiguous", refs: outcome.candidates };
    if (outcome.type === "invalid") return { status: "invalid" };
    return { status: "unresolved" };
};

// One model call per case with no re-ask, so this measures the model's direct capability.
const runOneCase = async (testCase, apiKey) => {
    const board = BOARDS_BY_NAME[testCase.board];
    const shareId = `benchmark-${testCase.id}`;
    const groundedScene = await buildGroundedScene(shareId, board.elements);
    const ranked = testCase.targetPhrase ? resolveReference(groundedScene, testCase.targetPhrase) : [];

    if (!apiKey) {
        const graded = gradeCase(testCase, { ranked, pipelineResult: { status: "skipped" }, beforeElements: board.elements });
        return { ...graded, modelCalls: 0, latencyMs: null };
    }

    const messages = buildMessages({
        secrets: createTurnSecrets(),
        message: testCase.instruction,
        buildContext: (charBudget) => serializeSceneContext(groundedScene, { viewport: null, selection: [], charBudget }),
        contextLevel: 0,
        history: [],
        recentActions: [],
        mostRecentRef: null,
        selectionRefs: [],
    });

    const startedAt = Date.now();
    try {
        const raw = await chatCompletionWithBackoff({ apiKey, role: "reasoning", messages, responseSchema: AGENT_RESPONSE_SCHEMA });
        const pipelineResult = pipelineResultFor(parseAgentResponse(raw), board, groundedScene);
        const graded = gradeCase(testCase, { ranked, pipelineResult, beforeElements: board.elements });
        return { ...graded, modelCalls: 1, latencyMs: Date.now() - startedAt };
    } catch (error) {
        const graded = gradeCase(testCase, { ranked, pipelineResult: { status: "error" }, beforeElements: board.elements });
        return { ...graded, modelCalls: 1, latencyMs: Date.now() - startedAt, error: error.message };
    }
};

const main = async () => {
    const argv = process.argv.slice(2);
    const delayMs = Number(argValue(argv, "--delay-ms", DEFAULT_DELAY_MS));
    const categories = argValue(argv, "--category", null)?.split(",");
    const cases = categories ? EDIT_BENCHMARK_CASES.filter((testCase) => categories.includes(testCase.category)) : EDIT_BENCHMARK_CASES;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.log("GROQ_API_KEY not set - reporting resolution accuracy only; edit validity and geometric regression are n/a for this run.\n");
    }

    const results = [];
    for (const testCase of cases) {
        results.push(await runOneCase(testCase, apiKey));
        if (apiKey && delayMs > 0) await sleep(delayMs);
    }

    const summary = summarizeResults(results);
    const lines = [formatSummaryTable(summary)];

    const errored = results.filter((result) => result.pipelineStatus === "error");
    if (errored.length > 0) {
        lines.push(`\n${errored.length} case(s) errored and were excluded from edit-validity/geometric scoring:`);
        errored.forEach((failure) => lines.push(`  ${failure.id} (${failure.category}): ${failure.error}`));
    }

    const failures = results.filter((result) => result.editValidity && !result.editValidity.valid);
    if (failures.length > 0) {
        lines.push(`\n${failures.length} case(s) failed edit validity:`);
        failures.forEach((failure) => lines.push(`  ${failure.id} (${failure.category}): ${failure.editValidity.reason}`));
    }

    const report = lines.join("\n");
    console.log(report);

    const outPath = argValue(argv, "--out", null);
    if (outPath) {
        const header = `# Canvas edit benchmark run\n\nGenerated ${new Date().toISOString()} against ${apiKey ? "a live model" : "resolution-only (no GROQ_API_KEY)"}.\n\n\`\`\`\n`;
        writeFileSync(outPath, `${header}${report}\n\`\`\`\n`);
        console.log(`\nWrote report to ${outPath}`);
    }
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
