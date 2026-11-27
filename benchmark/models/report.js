const percent = (value) => (value === null || value === undefined ? "n/a" : `${Math.round(value * 100)}%`);
const average = (values) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

const rollUp = (results) => ({
    runs: results.length,
    drawn: average(results.map((result) => (result.grade.drawn ? 1 : 0))),
    valid: average(results.filter((result) => result.grade.drawn).map((result) => result.grade.validShare)),
    coverage: average(results.map((result) => result.grade.coverage).filter((value) => value !== null)),
    overlaps: average(results.filter((result) => result.kind === "diagram" && result.grade.drawn).map((result) => result.grade.overlappingLabels)),
    connectors: average(results.filter((result) => result.kind === "diagram" && result.grade.drawn).map((result) => result.grade.connectors)),
    tokens: average(results.map((result) => result.usage.inputTokens + result.usage.outputTokens)),
    latency: average(results.map((result) => result.usage.modelMs)),
});

const imageCell = (result) => (result ? (result.grade.drawn ? `![${result.variant}](${result.image})` : `_${result.outcome}_`) : "not run");

// Everything on disk, so a run spread over several days of free allowance still reports as one.
export const formatModelReport = ({ results, variants, tasks, labels = new Map(), notes = [] }) => {
    const models = [...new Set(results.map((result) => result.modelKey))].sort();
    const labelOf = (modelKey) => labels.get(modelKey) ?? modelKey;
    const lines = [
        "# Assistant model benchmark",
        "",
        "Each model runs every task twice: through the first version of the assistant (one prompt asking for raw",
        "coordinates on a fixed grid) and through Mosaic today (typed intents, the diagram style engine and named",
        "sketch parts). Same model, same words; the difference is the code around it.",
        "",
        "Drawn: produced something to place. Valid: elements the board accepts as they are. Coverage: the labels a",
        "faithful diagram must carry. Overlaps: labelled boxes covering each other, per diagram. Arrows: connections drawn, per diagram. Tokens and the model's own",
        "time per task, without the pauses that keep a run inside the free allowance.",
        "",
        ...notes.flatMap((note) => [note, ""]),
        "| Model | Version | Tasks | Drawn | Valid | Coverage | Overlaps | Arrows | Tokens | Time |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ];
    for (const modelKey of models) {
        let named = false;
        for (const variant of Object.keys(variants)) {
            const mine = results.filter((result) => result.modelKey === modelKey && result.variant === variant);
            if (mine.length === 0) continue;
            const summary = rollUp(mine);
            lines.push(
                `| ${named ? "" : labelOf(modelKey)} | ${variants[variant].label} | ${summary.runs} | ${percent(summary.drawn)} | ${percent(summary.valid)} | ${percent(summary.coverage)} | ${summary.overlaps === null ? "n/a" : summary.overlaps.toFixed(1)} | ${summary.connectors === null ? "n/a" : summary.connectors.toFixed(1)} | ${Math.round(summary.tokens ?? 0)} | ${seconds(summary.latency ?? 0)} |`,
            );
            named = true;
        }
    }

    lines.push("", "## Side by side", "");
    for (const task of tasks) {
        lines.push(
            `### ${task.prompt}`,
            "",
            `| Model | ${Object.values(variants)
                .map((variant) => variant.label)
                .join(" | ")} |`,
            `| --- |${" --- |".repeat(Object.keys(variants).length)}`,
        );
        for (const modelKey of models) {
            const cells = Object.keys(variants).map((variant) =>
                imageCell(results.find((result) => result.modelKey === modelKey && result.variant === variant && result.task === task.id)),
            );
            lines.push(`| ${labelOf(modelKey)} | ${cells.join(" | ")} |`);
        }
        lines.push("");
    }
    return `${lines.join("\n")}\n`;
};
