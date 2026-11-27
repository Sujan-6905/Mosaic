// Per-case grades rolled up overall and per category, so a weak category isn't averaged away.
const rate = (numerator, denominator) => (denominator === 0 ? null : numerator / denominator);

const emptyBucket = () => ({
    total: 0,
    resolutionAt1: 0,
    resolutionAt3: 0,
    resolutionScored: 0,
    editValid: 0,
    editScored: 0,
    regressed: 0,
    regressionScored: 0,
    askCount: 0,
    modelCalls: 0,
    latencyMs: [],
});

const foldInto = (bucket, result) => {
    bucket.total += 1;
    bucket.modelCalls += result.modelCalls ?? 0;
    if (typeof result.latencyMs === "number") bucket.latencyMs.push(result.latencyMs);
    if (result.pipelineStatus === "ambiguous") bucket.askCount += 1;

    if (result.resolution) {
        bucket.resolutionScored += 1;
        if (result.resolution.correctAt1) bucket.resolutionAt1 += 1;
        if (result.resolution.correctAt3) bucket.resolutionAt3 += 1;
    }

    if (result.editValidity) {
        bucket.editScored += 1;
        if (result.editValidity.valid) bucket.editValid += 1;
    }

    if (result.geometric) {
        bucket.regressionScored += 1;
        if (result.geometric.regressed) bucket.regressed += 1;
    }
};

const summarize = (bucket) => ({
    total: bucket.total,
    resolutionAccuracyAt1: rate(bucket.resolutionAt1, bucket.resolutionScored),
    resolutionAccuracyAt3: rate(bucket.resolutionAt3, bucket.resolutionScored),
    editValidityRate: rate(bucket.editValid, bucket.editScored),
    geometricRegressionRate: rate(bucket.regressed, bucket.regressionScored),
    askRate: rate(bucket.askCount, bucket.total),
    avgModelCallsPerInstruction: bucket.total === 0 ? null : bucket.modelCalls / bucket.total,
    avgLatencyMs: bucket.latencyMs.length === 0 ? null : bucket.latencyMs.reduce((sum, ms) => sum + ms, 0) / bucket.latencyMs.length,
});

// `results` are gradeCase outputs, each also carrying `modelCalls` and `latencyMs`.
export const summarizeResults = (results) => {
    const overallBucket = emptyBucket();
    const byCategory = {};

    results.forEach((result) => {
        foldInto(overallBucket, result);
        if (!byCategory[result.category]) byCategory[result.category] = emptyBucket();
        foldInto(byCategory[result.category], result);
    });

    return {
        overall: summarize(overallBucket),
        byCategory: Object.fromEntries(Object.entries(byCategory).map(([category, bucket]) => [category, summarize(bucket)])),
    };
};

const pct = (value) => (value === null ? "n/a" : `${(value * 100).toFixed(1)}%`);
const num = (value, digits = 1) => (value === null ? "n/a" : value.toFixed(digits));

// A plain-text table, committed as the diffable result.
export const formatSummaryTable = (summary) => {
    const rows = [["category", "n", "res@1", "res@3", "edit-valid", "geo-regression", "ask-rate", "calls/instr", "avg ms"]];
    const rowFor = (label, s) => [
        label,
        String(s.total),
        pct(s.resolutionAccuracyAt1),
        pct(s.resolutionAccuracyAt3),
        pct(s.editValidityRate),
        pct(s.geometricRegressionRate),
        pct(s.askRate),
        num(s.avgModelCallsPerInstruction, 2),
        num(s.avgLatencyMs, 0),
    ];

    rows.push(rowFor("overall", summary.overall));
    Object.entries(summary.byCategory)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([category, s]) => rows.push(rowFor(category, s)));

    const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)));
    return rows.map((row) => row.map((cell, col) => cell.padEnd(widths[col])).join("  ")).join("\n");
};
