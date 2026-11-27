const ms = (value) => (value < 10 ? value.toFixed(2) : value.toFixed(1));

// Below this, what a store adds to the round trip is within the network's own jitter.
const NOISE_MS = 1;

const compare = (a, b) => {
    if (!a || !b) return "";
    const [own, other] = [a.aboveRoundTrip, b.aboveRoundTrip];
    if (own < NOISE_MS && other < NOISE_MS) return "both within a round trip";
    if (own < NOISE_MS || other < NOISE_MS) return own < other ? "faster" : "slower";
    const ratio = other / own;
    return ratio >= 1 ? `${ratio.toFixed(1)}x faster` : `${(1 / ratio).toFixed(1)}x slower`;
};

// One row per store and workload: client latency, the round trip measured just before, and what the store added to it.
export const formatStorageReport = ({ startedAt, settings, stores, results }) => {
    const [first, second] = stores;
    const lines = [
        "# Storage benchmark",
        "",
        `Run ${startedAt} from the same machine against both stores. ${settings.iterations} timed calls per workload after ${settings.warmup} untimed,`,
        `${settings.concurrency} at a time. Each figure is the median of ${settings.runs} passes, and in every pass both stores run each workload back to`,
        `back, taking turns to go first. Dataset: ${settings.dataset.boards} boards of ${settings.dataset.elementsPerBoard} elements, ${settings.dataset.opsPerBoard} logged operations and a`,
        `version every ${settings.dataset.snapshotEvery} per board. Latencies are milliseconds measured at the client, so they include the network.`,
        "",
        "## Network baseline",
        "",
        "| Store | Round trip p50 | p95 |",
        "| --- | --- | --- |",
        ...stores.map((store) => `| ${store.name} | ${ms(results.ping[store.id].p50)} | ${ms(results.ping[store.id].p95)} |`),
        "",
        "A store in a nearer region wins every call by about the difference, so the comparison below uses what each store adds",
        "on top of a round trip measured just before that workload, not the raw latency.",
        "",
        "## Workloads",
        "",
        `| Workload | Store | p50 | p95 | p99 | ops/s | Round trip p50 | p50 above round trip |${second ? ` ${first.name} vs ${second.name}, above round trip |` : ""}`,
        `| --- | --- | --- | --- | --- | --- | --- | --- |${second ? " --- |" : ""}`,
    ];
    for (const workload of results.workloads) {
        stores.forEach((store, index) => {
            const stats = workload.byStore[store.id];
            if (!stats) return;
            const comparison = second && index === 0 ? ` ${compare(stats, workload.byStore[second.id])} |` : second ? " |" : "";
            lines.push(
                `| ${index === 0 ? workload.label : ""} | ${store.name} | ${ms(stats.p50)} | ${ms(stats.p95)} | ${ms(stats.p99)} | ${stats.opsPerSecond.toFixed(1)} | ${ms(stats.roundTripP50)} | ${ms(stats.aboveRoundTrip)} |${comparison}`,
            );
        });
    }
    const checked = results.workloads.filter((workload) => stores.some((store) => workload.byStore[store.id]?.kept !== undefined));
    checked.forEach((workload) =>
        lines.push(
            "",
            `${workload.label}: ${stores.map((store) => `${store.name} ${workload.byStore[store.id]?.kept ? "kept every write" : "lost a write"}`).join(", ")}.`,
        ),
    );
    return `${lines.join("\n")}\n`;
};
