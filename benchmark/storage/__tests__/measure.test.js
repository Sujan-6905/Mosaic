import { describe, it, expect } from "vitest";
import { measure, medianOfPasses, summarize } from "../measure.js";
import { buildBoard, buildOps } from "../fixtures.js";
import { formatStorageReport } from "../report.js";

describe("summarize", () => {
    it("reports percentiles and throughput", () => {
        const stats = summarize([5, 1, 4, 2, 3], 1000);
        expect(stats).toMatchObject({ count: 5, p50: 3, p99: 5, mean: 3, opsPerSecond: 5 });
    });
});

describe("measure", () => {
    it("times every iteration once, after the warmup", async () => {
        const seen = [];
        const stats = await measure(async (i) => seen.push(i), { iterations: 6, concurrency: 3, warmup: 2 });
        expect(stats.count).toBe(6);
        expect(seen.filter((i) => i >= 0).sort()).toEqual([0, 1, 2, 3, 4, 5]);
        expect(seen.filter((i) => i < 0)).toHaveLength(2);
    });
});

describe("fixtures", () => {
    it("builds the same board from the same index", () => {
        expect(buildBoard(3, { elementsPerBoard: 20, owners: 2 })).toEqual(buildBoard(3, { elementsPerBoard: 20, owners: 2 }));
    });

    it("numbers operations from the seq it is given", () => {
        expect(buildOps("b", 10, 3, ["e1"]).map((op) => op.seq)).toEqual([10, 11, 12]);
    });
});

describe("formatStorageReport", () => {
    const stats = (p50, roundTripP50) => ({ p50, p95: p50, p99: p50, opsPerSecond: 10, roundTripP50, aboveRoundTrip: Math.max(0, p50 - roundTripP50) });
    const report = (near, far) =>
        formatStorageReport({
            startedAt: "2026-01-01T00:00:00.000Z",
            settings: { iterations: 1, warmup: 0, concurrency: 1, runs: 1, dataset: { boards: 1, elementsPerBoard: 1, opsPerBoard: 1, snapshotEvery: 1 } },
            stores: [
                { id: "far", name: "Far" },
                { id: "near", name: "Near" },
            ],
            results: {
                ping: { far: stats(50, 50), near: stats(25, 25) },
                workloads: [{ id: "get", label: "Get", byStore: { far: far, near: near } }],
            },
        });

    it("compares stores on what each adds to its own round trip", () => {
        expect(report(stats(37, 25), stats(54, 50))).toMatch(/\| Get \| Far \| 54\.0 .* \| 4\.00 \| 3\.0x faster \|/);
    });

    it("calls two stores even when neither adds more than the network jitter", () => {
        expect(report(stats(25.5, 25), stats(50.2, 50))).toMatch(/both within a round trip/);
    });
});

describe("medianOfPasses", () => {
    it("takes the median of every figure and keeps writes only if every pass kept them", () => {
        const merged = medianOfPasses([
            { p50: 10, aboveRoundTrip: 3, kept: true },
            { p50: 30, aboveRoundTrip: 1, kept: false },
            { p50: 20, aboveRoundTrip: 2, kept: true },
        ]);
        expect(merged).toEqual({ p50: 20, aboveRoundTrip: 2, kept: false, passes: 3 });
    });
});
