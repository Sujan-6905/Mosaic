#!/usr/bin/env node
// Times the app's storage paths on Couchbase Capella and MongoDB with identical data, from one machine.
// Needs CB_* and MONGODB_URI in backend/.env; flags in benchmark/README.md.
import "./backendEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openCouchbase } from "./storage/couchbaseStore.js";
import { openMongo } from "./storage/mongoStore.js";
import { measure, medianOfPasses } from "./storage/measure.js";
import { DATASET, WORKLOADS, seedDataset } from "./storage/workloads.js";
import { formatStorageReport } from "./storage/report.js";

const RESULTS_DIR = new URL("./results/", import.meta.url).pathname;
const STORES = {
    couchbase: { open: openCouchbase, needs: ["CB_CONNECTION_STRING", "CB_USERNAME", "CB_PASSWORD", "CB_BUCKET_NAME"] },
    mongodb: { open: openMongo, needs: ["MONGODB_URI"] },
};

const argValue = (flag, fallback) => {
    const index = process.argv.indexOf(flag);
    return index === -1 ? fallback : process.argv[index + 1];
};
const listArg = (flag, fallback) => argValue(flag, fallback.join(",")).split(",").filter(Boolean);

const settings = {
    iterations: Number(argValue("--iterations", 200)),
    concurrency: Number(argValue("--concurrency", 4)),
    warmup: Number(argValue("--warmup", 10)),
    runs: Number(argValue("--runs", 3)),
    keep: process.argv.includes("--keep"),
    dataset: DATASET,
};
const storeIds = listArg("--stores", Object.keys(STORES));
const workloads = WORKLOADS.filter((workload) =>
    listArg(
        "--only",
        WORKLOADS.map(({ id }) => id),
    ).includes(workload.id),
);

const unknown = storeIds.filter((id) => !STORES[id]);
const missing = storeIds.filter((id) => STORES[id]).flatMap((id) => STORES[id].needs.filter((name) => !process.env[name]));
if (unknown.length > 0 || missing.length > 0) {
    console.error(
        unknown.length > 0
            ? `Unknown store ${unknown.join(", ")}; choose from ${Object.keys(STORES).join(", ")}.`
            : `Set ${missing.join(", ")} in backend/.env.`,
    );
    process.exit(1);
}

const startedAt = new Date().toISOString();
const opened = [];
const samples = new Map(workloads.map(({ id }) => [id, new Map(storeIds.map((storeId) => [storeId, []]))]));
const pings = new Map(storeIds.map((storeId) => [storeId, []]));

try {
    for (const storeId of storeIds) {
        const store = await STORES[storeId].open();
        console.log(`\n${store.name}: seeding ${DATASET.boards} boards`);
        const boards = await seedDataset(store);
        // One runner per workload for the whole run, so passes carry on from each other's writes.
        opened.push({ id: storeId, store, boards, runners: new Map(workloads.map((workload) => [workload.id, workload.run(store, boards)])) });
    }
    for (let pass = 0; pass < settings.runs; pass += 1) {
        // Both stores take each workload back to back, first one then the other, so they share the network's conditions.
        const order = pass % 2 === 0 ? opened : [...opened].reverse();
        console.log(`\nPass ${pass + 1} of ${settings.runs}, ${order.map(({ store }) => store.name).join(" then ")}`);
        for (const { id, store } of order) pings.get(id).push(await measure(() => store.ping(), settings));
        for (const workload of workloads) {
            for (const { id, store, boards, runners } of order) {
                const roundTrip = await measure(() => store.ping(), settings);
                const stats = await measure(runners.get(workload.id), { ...settings, concurrency: workload.concurrency ?? settings.concurrency });
                stats.roundTripP50 = roundTrip.p50;
                stats.aboveRoundTrip = Math.max(0, stats.p50 - roundTrip.p50);
                if (workload.check) stats.kept = await workload.check(store, boards, settings.iterations - 1);
                samples.get(workload.id).get(id).push(stats);
                console.log(
                    `  ${workload.id.padEnd(20)} ${store.name.padEnd(18)} p50 ${stats.p50.toFixed(1)}ms  round trip ${roundTrip.p50.toFixed(1)}ms  above it ${stats.aboveRoundTrip.toFixed(1)}ms`,
                );
            }
        }
    }
} finally {
    for (const { store } of opened) await store.teardown({ keep: settings.keep });
}

const stores = opened.map(({ id, store }) => ({ id, name: store.name }));
const results = {
    ping: Object.fromEntries(storeIds.map((storeId) => [storeId, medianOfPasses(pings.get(storeId))])),
    workloads: workloads.map(({ id, label }) => ({
        id,
        label,
        byStore: Object.fromEntries(storeIds.map((storeId) => [storeId, medianOfPasses(samples.get(id).get(storeId))])),
    })),
};

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(join(RESULTS_DIR, "storage-benchmark.json"), `${JSON.stringify({ startedAt, settings, stores, results }, null, 2)}\n`);
writeFileSync(join(RESULTS_DIR, "storage-benchmark.md"), formatStorageReport({ startedAt, settings, stores, results }));
console.log(`\nResults in ${RESULTS_DIR}storage-benchmark.md`);
