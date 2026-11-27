import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    recordOp,
    recordError,
    recordCapRejection,
    recordRoomOccupancy,
    recordRoomOp,
    recordPresenceEvent,
    recordSaveLatency,
    recordSaveFailure,
    recordClientError,
    recordAiGeneration,
    recordAiFailure,
    recordAiModelCall,
    recordResolutionOutcome,
    recordSanitizationDrop,
    recordLintBlock,
    recordAgentStageTiming,
    tickOpsPerSec,
    startOpsPerSecTicker,
    getMetrics,
    _resetForTests,
} from "../metrics.js";
import { _resetForTests as _resetAlertsForTests } from "../alerts.js";
import logger from "../logger.js";

beforeEach(() => {
    _resetForTests();
    _resetAlertsForTests();
});

const base = { rooms: 0, sockets: 0, roomOccupancy: 0 };

describe("getMetrics", () => {
    it("starts at zero for errors, opsPerSec, boardCapRejections and peakBoardOccupancy", () => {
        expect(getMetrics(base)).toEqual({
            errors: 0,
            clientErrors: 0,
            opsPerSec: 0,
            rooms: 0,
            sockets: 0,
            roomOccupancy: 0,
            boardCapRejections: 0,
            peakBoardOccupancy: 0,
            saveFailures: 0,
            saveLatencyMs: { p50: 0, p95: 0, max: 0, samples: 0 },
            ai: {
                generationsToday: 0,
                failuresToday: 0,
                modelCallsToday: 0,
                tokensApproxToday: 0,
                turns: {
                    byOutcome: {},
                    byErrorType: {},
                    inputTokens: 0,
                    outputTokens: 0,
                    flaggedByGuards: 0,
                    fallbackModelUsed: 0,
                    latencyP50Ms: null,
                    latencyP95Ms: null,
                },
                agentStageLatencyMs: {},
            },
            grounding: {
                resolutionResolvedToday: 0,
                resolutionAmbiguousToday: 0,
                resolutionNoneToday: 0,
                sanitizationDropsToday: 0,
                lintBlocksToday: 0,
            },
            resourceUsage: expect.objectContaining({
                rssBytes: expect.any(Number),
                heapUsedBytes: expect.any(Number),
                redisMemoryBytes: null,
            }),
            activeRooms: [],
        });
    });

    it("passes rooms, sockets and roomOccupancy through verbatim - they're read live from socket.js/canvasStore, not tracked here", () => {
        expect(getMetrics({ rooms: 3, sockets: 7, roomOccupancy: 5 })).toMatchObject({ rooms: 3, sockets: 7, roomOccupancy: 5 });
    });

    it("merges each activeRooms entry's occupancy with its own op/presence rate, sorted busiest-first", () => {
        recordRoomOp("board-quiet");
        recordRoomOp("board-busy");
        recordRoomOp("board-busy");
        recordPresenceEvent("board-busy");
        tickOpsPerSec();

        const activeRooms = [
            { shareId: "board-quiet", occupancy: 5 },
            { shareId: "board-busy", occupancy: 2 },
        ];

        expect(getMetrics({ ...base, activeRooms }).activeRooms).toEqual([
            { shareId: "board-quiet", occupancy: 5, opsPerSec: 1, presenceEventsPerSec: 0 },
            { shareId: "board-busy", occupancy: 2, opsPerSec: 2, presenceEventsPerSec: 1 },
        ]);
    });

    it("a room with no ops/presence events this tick reports zero rather than being omitted", () => {
        expect(getMetrics({ ...base, activeRooms: [{ shareId: "board-idle", occupancy: 1 }] }).activeRooms).toEqual([
            { shareId: "board-idle", occupancy: 1, opsPerSec: 0, presenceEventsPerSec: 0 },
        ]);
    });
});

describe("recordError", () => {
    it("increments the errors counter, cumulatively", () => {
        recordError();
        recordError();
        expect(getMetrics(base).errors).toBe(2);
    });
});

describe("recordCapRejection / recordRoomOccupancy", () => {
    it("increments boardCapRejections cumulatively", () => {
        recordCapRejection();
        recordCapRejection();
        expect(getMetrics(base).boardCapRejections).toBe(2);
    });

    it("tracks peakBoardOccupancy as a high-water mark, not the latest value", () => {
        recordRoomOccupancy(3);
        recordRoomOccupancy(7);
        recordRoomOccupancy(2);
        expect(getMetrics(base).peakBoardOccupancy).toBe(7);
    });
});

describe("recordOp / tickOpsPerSec", () => {
    it("publishes the tick's op count as opsPerSec and resets the running counter", () => {
        recordOp();
        recordOp();
        recordOp();
        expect(getMetrics(base).opsPerSec).toBe(0);

        tickOpsPerSec();
        expect(getMetrics(base).opsPerSec).toBe(3);

        // No new ops before the next tick: the published rate drops to 0,
        // it doesn't keep the previous tick's count around.
        tickOpsPerSec();
        expect(getMetrics(base).opsPerSec).toBe(0);
    });
});

describe("recordSaveLatency", () => {
    it("reports p50/p95/max/samples over the recorded durations", () => {
        [10, 20, 30, 40, 100].forEach(recordSaveLatency);

        const { saveLatencyMs } = getMetrics(base);
        expect(saveLatencyMs.samples).toBe(5);
        expect(saveLatencyMs.max).toBe(100);
        expect(saveLatencyMs.p50).toBe(30);
    });

    it("keeps only the most recent 200 samples", () => {
        for (let i = 0; i < 250; i++) recordSaveLatency(i);
        expect(getMetrics(base).saveLatencyMs.samples).toBe(200);
    });
});

describe("recordSaveFailure / recordClientError / recordAiGeneration / recordAiFailure", () => {
    it("each increments its own cumulative counter independently", () => {
        recordSaveFailure();
        recordSaveFailure();
        recordClientError();
        recordAiGeneration();
        recordAiGeneration();
        recordAiGeneration();
        recordAiFailure();

        const metrics = getMetrics(base);
        expect(metrics.saveFailures).toBe(2);
        expect(metrics.clientErrors).toBe(1);
        expect(metrics.ai.generationsToday).toBe(3);
        expect(metrics.ai.failuresToday).toBe(1);
    });

    it("tracks per-stage agent latency", () => {
        recordAgentStageTiming("planning", 100);
        recordAgentStageTiming("planning", 300);
        recordAgentStageTiming("checking", 50);

        const metrics = getMetrics(base);
        expect(metrics.ai.agentStageLatencyMs).toEqual({
            planning: { count: 2, avgMs: 200 },
            checking: { count: 1, avgMs: 50 },
        });
    });

    it("tracks resolution outcomes, sanitization drops, and lint blocks independently", () => {
        recordResolutionOutcome("resolved");
        recordResolutionOutcome("resolved");
        recordResolutionOutcome("ambiguous");
        recordResolutionOutcome("none");
        recordResolutionOutcome("unknown-status"); // not one of the three: silently ignored, not miscounted
        recordSanitizationDrop();
        recordLintBlock();
        recordLintBlock();

        const metrics = getMetrics(base);
        expect(metrics.grounding).toEqual({
            resolutionResolvedToday: 2,
            resolutionAmbiguousToday: 1,
            resolutionNoneToday: 1,
            sanitizationDropsToday: 1,
            lintBlocksToday: 2,
        });
    });

    it("tracks model calls and approximate tokens", () => {
        recordAiModelCall(120);
        recordAiModelCall(80);

        const metrics = getMetrics(base);
        expect(metrics.ai.modelCallsToday).toBe(2);
        expect(metrics.ai.tokensApproxToday).toBe(200);
    });
});

describe("recordError / tickOpsPerSec alerting", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(logger, "fatal").mockImplementation(() => {});
    });

    it("does not alert when the per-second error count stays under the threshold", () => {
        for (let i = 0; i < 20; i++) recordError();
        tickOpsPerSec();
        expect(logger.fatal).not.toHaveBeenCalled();
    });

    it("alerts once the per-second error count exceeds the threshold", () => {
        for (let i = 0; i < 21; i++) recordError();
        tickOpsPerSec();
        expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining({ kind: "error-rate-high" }), "alert condition triggered");
    });

    it("resets the per-tick error count so a later normal tick doesn't re-alert", () => {
        for (let i = 0; i < 21; i++) recordError();
        tickOpsPerSec();
        vi.mocked(logger.fatal).mockClear();

        recordError();
        tickOpsPerSec();
        expect(logger.fatal).not.toHaveBeenCalled();
    });
});

describe("startOpsPerSecTicker", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("ticks once per second on its own, without a manual tickOpsPerSec() call", () => {
        recordOp();
        recordOp();

        const timer = startOpsPerSecTicker();
        vi.advanceTimersByTime(1000);

        expect(getMetrics(base).opsPerSec).toBe(2);
        clearInterval(timer);
    });
});
