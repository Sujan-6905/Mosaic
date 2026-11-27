import { describe, it, expect } from "vitest";
import { pushBounded, summarizeFrameTimes, buildSnapshot } from "../perfHarness.js";

describe("pushBounded", () => {
    it("appends while under the cap", () => {
        const buffer = [1, 2];
        expect(pushBounded(buffer, 3, 5)).toEqual([1, 2, 3]);
    });

    it("drops the oldest sample once the cap is hit", () => {
        const buffer = [1, 2, 3];
        pushBounded(buffer, 4, 3);
        expect(buffer).toEqual([2, 3, 4]);
    });
});

describe("summarizeFrameTimes", () => {
    it("returns zeroed stats for an empty buffer", () => {
        expect(summarizeFrameTimes([])).toEqual({ count: 0, p50: 0, p95: 0, p99: 0, max: 0, avgFps: 0 });
    });

    it("computes percentiles and average fps from ms-per-frame samples", () => {
        const frameTimes = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100ms
        const stats = summarizeFrameTimes(frameTimes);
        expect(stats.count).toBe(100);
        expect(stats.max).toBe(100);
        expect(stats.p50).toBeGreaterThan(40);
        expect(stats.p50).toBeLessThan(60);
        expect(stats.p95).toBeGreaterThan(stats.p50);
        expect(stats.p99).toBeGreaterThanOrEqual(stats.p95);
    });

    it("derives avgFps as the inverse of average frame time", () => {
        const stats = summarizeFrameTimes([16, 16, 16, 16]);
        expect(stats.avgFps).toBe(63); // 1000/16 rounded
    });
});

describe("buildSnapshot", () => {
    it("assembles a full snapshot from raw counters", () => {
        const snapshot = buildSnapshot({
            frameTimes: [16, 16],
            staticRepaints: 2,
            staticInsertDrains: 1,
            socketMessageCount: 5,
            totalElementCount: 100,
        });
        expect(snapshot.staticRepaints).toBe(2);
        expect(snapshot.socketMessageCount).toBe(5);
        expect(snapshot.totalElementCount).toBe(100);
        expect(snapshot.frameTime.count).toBe(2);
    });
});
