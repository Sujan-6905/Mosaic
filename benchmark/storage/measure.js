const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

export const summarize = (samples, wallMs) => {
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    return {
        count: sorted.length,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        mean,
        opsPerSecond: (sorted.length / wallMs) * 1000,
    };
};

// Runs `task(i)` `iterations` times across `concurrency` workers after `warmup` untimed calls.
export const measure = async (task, { iterations, concurrency, warmup }) => {
    for (let i = 0; i < warmup; i += 1) await task(-1 - i);
    const samples = [];
    let next = 0;
    const startedAt = performance.now();
    const worker = async () => {
        for (let i = next++; i < iterations; i = next++) {
            const begin = performance.now();
            await task(i);
            samples.push(performance.now() - begin);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, iterations) }, worker));
    return summarize(samples, performance.now() - startedAt);
};

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Several passes of one workload as one row: the median of every figure, and kept only if every pass kept every write.
export const medianOfPasses = (passes) => {
    const numeric = Object.keys(passes[0]).filter((key) => typeof passes[0][key] === "number");
    const merged = Object.fromEntries(numeric.map((key) => [key, median(passes.map((pass) => pass[key]))]));
    if (passes.some((pass) => pass.kept !== undefined)) merged.kept = passes.every((pass) => pass.kept);
    return { ...merged, passes: passes.length };
};
