#!/usr/bin/env node
// Resolution accuracy across grounding-layer configurations, plus the grouping harness's
// temporal-signal comparison. Each configuration runs in its own process because flags load once.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runGroupingBenchmark } from "../backend/src/grounding/eval/groupingHarness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUN_BENCHMARK_PATH = path.join(__dirname, "runBenchmark.js");

// Each row re-enables one more signal than the row before it, starting from raw elements.
const CONFIGURATIONS = [
    { name: "baseline (no grouping, no relations)", disabledLayers: "grouping,temporal-grouping,relations" },
    { name: "+ structural grouping", disabledLayers: "temporal-grouping,relations" },
    { name: "+ temporal grouping signal", disabledLayers: "relations" },
    { name: "+ relations (full stack)", disabledLayers: "" },
];

const TABLE_ROW_PATTERN = /^overall\s+(\d+)\s+([\d.]+)%\s+([\d.]+)%/m;

const runConfiguration = (disabledLayers) => {
    const args = disabledLayers ? [RUN_BENCHMARK_PATH, "--flags", disabledLayers] : [RUN_BENCHMARK_PATH];
    // No GROQ_API_KEY: resolution accuracy is symbolic, so the study never calls a model.
    // on why this study is resolution-accuracy only.
    const output = execFileSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, GROQ_API_KEY: "" } });
    const match = output.match(TABLE_ROW_PATTERN);
    if (!match) throw new Error(`could not parse runBenchmark.js output:\n${output}`);
    return { total: Number(match[1]), resolutionAt1: Number(match[2]), resolutionAt3: Number(match[3]) };
};

// A minimal bar built from block characters: readable in a committed
// markdown file with no image, chart library, or surrounding prose needed.
const bar = (percent, width = 40) => "#".repeat(Math.round((percent / 100) * width)).padEnd(width, "-");

const main = () => {
    console.log("Running grounding-layer ablation (resolution accuracy@1/@3, no model calls)...\n");
    const rows = CONFIGURATIONS.map((config) => {
        const result = runConfiguration(config.disabledLayers);
        console.log(`  ${config.name}: res@1=${result.resolutionAt1}% res@3=${result.resolutionAt3}%`);
        return { ...config, ...result };
    });

    console.log("\nRunning the grouping harness's own temporal-signal comparison...\n");
    const groupingResults = runGroupingBenchmark();

    const chartLines = rows.map((row) => `${row.name.padEnd(32)} ${bar(row.resolutionAt1)} ${row.resolutionAt1}%`);

    const groupingChartLines = Object.entries(groupingResults).map(
        ([config, data]) => `${config.padEnd(32)} ${bar(data.overall.f1 * 100)} F1=${data.overall.f1.toFixed(3)}`,
    );

    const report = `# Layer ablation study

Generated ${new Date().toISOString().slice(0, 10)} by \`node benchmark/runAblation.js\`. Resolution accuracy is symbolic,
so the study needs no model and reproduces exactly from a clean checkout.

## Resolution accuracy@1, by grounding-layer configuration

\`\`\`
${chartLines.join("\n")}
\`\`\`

| Configuration | n | res@1 | res@3 |
|---|---|---|---|
${rows.map((row) => `| ${row.name} | ${row.total} | ${row.resolutionAt1}% | ${row.resolutionAt3}% |`).join("\n")}

## Temporal grouping signal, on its own (grouping harness, F1 over same-object pairs)

\`\`\`
${groupingChartLines.join("\n")}
\`\`\`

| Configuration | Precision | Recall | F1 |
|---|---|---|---|
${Object.entries(groupingResults)
    .map(([config, data]) => `| ${config} | ${data.overall.precision.toFixed(3)} | ${data.overall.recall.toFixed(3)} | ${data.overall.f1.toFixed(3)} |`)
    .join("\n")}

## What it shows

- **Structural grouping is the whole measured effect.** It lifts top-1 resolution from the baseline to
  the full-stack figure; the temporal signal and relations add nothing on these four small boards.
- **Temporal grouping is redundant while stroke order follows drawing order.** Structural grouping
  already merges consecutive nearby strokes by z-order, which is drawing order unless strokes were
  reordered, so the burst signal only adds merges on reordered boards. The harness's F1 of 1.0 for
  structural-only is that ceiling, not a missing fixture.
- **Relations would show on denser boards**, where identical objects are told apart only by what
  sits next to them; none of these boards need that.
- **Not ablated here:** the repair loop and the resolver switch. Repair changes edit validity, which
  needs a live model, and the resolver switch sits in the HTTP handler this harness bypasses.
`;

    writeFileSync(path.join(__dirname, "results", "ablation.md"), report);
    console.log("\nWrote benchmark/results/ablation.md");
};

main();
