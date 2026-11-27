import { sendAlert } from "./alerts.js";

// In-memory only: a multi-instance deployment needs these aggregated
// externally, same caveat as aiController.js's rate-limit counters.
const state = {
    errors: 0,
    opsSinceLastTick: 0,
    opsPerSec: 0,
    boardCapRejections: 0,
    peakBoardOccupancy: 0,
    saveFailures: 0,
    clientErrors: 0,
    aiGenerations: 0,
    aiFailures: 0,
    errorsSinceLastTick: 0,
    aiModelCalls: 0,
    aiTokensApprox: 0,
    resolutionResolved: 0,
    resolutionAmbiguous: 0,
    resolutionNone: 0,
    sanitizationDrops: 0,
    lintBlocks: 0,
};

// Count and total per assistant stage, so one slow stage isn't averaged away.
const agentStageTotals = new Map(); // stage -> { count, totalMs }

// Above an ordinary retry blip; a crash-looping handler crosses it.
const ERROR_RATE_ALERT_THRESHOLD = 20;

// The last N autosave durations, so p95 can show occasional slow sweeps.
const SAVE_LATENCY_SAMPLE_LIMIT = 200;
let saveLatencySamples = [];

const percentile = (sortedValues, p) => {
    if (sortedValues.length === 0) return 0;
    const index = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * p));
    return sortedValues[index];
};

// Reset each tick, so an idle room drops out instead of reporting zero forever.
const roomOpsSinceLastTick = new Map();
const roomOpsPerSec = new Map();
const roomPresenceEventsSinceLastTick = new Map();
const roomPresenceEventsPerSec = new Map();

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

const recordOp = () => {
    state.opsSinceLastTick += 1;
};

const recordError = () => {
    state.errors += 1;
    state.errorsSinceLastTick += 1;
};

const recordCapRejection = () => {
    state.boardCapRejections += 1;
};

// One sample per flush, success or failure; the caller measures the duration.
const recordSaveLatency = (durationMs) => {
    saveLatencySamples.push(durationMs);
    if (saveLatencySamples.length > SAVE_LATENCY_SAMPLE_LIMIT) {
        saveLatencySamples = saveLatencySamples.slice(-SAVE_LATENCY_SAMPLE_LIMIT);
    }
};

const recordSaveFailure = () => {
    state.saveFailures += 1;
};

const recordClientError = () => {
    state.clientErrors += 1;
};

const recordAiGeneration = () => {
    state.aiGenerations += 1;
};

const recordAiFailure = () => {
    state.aiFailures += 1;
};

// Every model call the shared Groq key pays for, across every AI role and every user.
const recordAiModelCall = (tokensApprox = 0) => {
    state.aiModelCalls += 1;
    state.aiTokensApprox += tokensApprox;
};

// Resolution outcomes: a rising ambiguous or none share is the ask-rate and miss-rate signal.
const RESOLUTION_OUTCOME_KEYS = { resolved: "resolutionResolved", ambiguous: "resolutionAmbiguous", none: "resolutionNone" };
const recordResolutionOutcome = (status) => {
    const key = RESOLUTION_OUTCOME_KEYS[status];
    if (key) state[key] += 1;
};

// An op or ref the model invented; a rising rate means the model is drifting from the board.
const recordSanitizationDrop = () => {
    state.sanitizationDrops += 1;
};

// A plan blocked by an error-level lint that repair couldn't clear.
const recordLintBlock = () => {
    state.lintBlocks += 1;
};

const TURN_LATENCY_SAMPLE_CAP = 500;
const aiTurnStats = { byOutcome: {}, byErrorType: {}, inputTokens: 0, outputTokens: 0, flagged: 0, fallbacks: 0, latencySamples: [] };

const recordAiTurn = ({ outcome, durationMs, inputTokens = 0, outputTokens = 0, flagged = false, usedFallback = false, errorType = null }) => {
    aiTurnStats.byOutcome[outcome] = (aiTurnStats.byOutcome[outcome] || 0) + 1;
    if (errorType) aiTurnStats.byErrorType[errorType] = (aiTurnStats.byErrorType[errorType] || 0) + 1;
    aiTurnStats.inputTokens += inputTokens;
    aiTurnStats.outputTokens += outputTokens;
    if (flagged) aiTurnStats.flagged += 1;
    if (usedFallback) aiTurnStats.fallbacks += 1;
    aiTurnStats.latencySamples.push(durationMs);
    if (aiTurnStats.latencySamples.length > TURN_LATENCY_SAMPLE_CAP) aiTurnStats.latencySamples.shift();
};

const turnLatencyPercentile = (fraction) => {
    const sorted = [...aiTurnStats.latencySamples].sort((a, b) => a - b);
    return sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
};

const recordAgentStageTiming = (stage, durationMs) => {
    const entry = agentStageTotals.get(stage) || { count: 0, totalMs: 0 };
    entry.count += 1;
    entry.totalMs += durationMs;
    agentStageTotals.set(stage, entry);
};

// The largest single-room occupancy ever observed: not the cluster-wide
// total (that's `roomOccupancy` below).
const recordRoomOccupancy = (count) => {
    if (count > state.peakBoardOccupancy) state.peakBoardOccupancy = count;
};

// Canvas mutations (client:updateCanvas/updateBackground), counted per
// shareId so a hot board is distinguishable from cluster-wide opsPerSec.
const recordRoomOp = (shareId) => bump(roomOpsSinceLastTick, shareId);

// Presence broadcasts outnumber canvas mutations by far, so they're counted apart.
const recordPresenceEvent = (shareId) => bump(roomPresenceEventsSinceLastTick, shareId);

// Called once a second: publishes the tick's op count as the rate and resets it.
const tickOpsPerSec = () => {
    state.opsPerSec = state.opsSinceLastTick;
    state.opsSinceLastTick = 0;

    if (state.errorsSinceLastTick > ERROR_RATE_ALERT_THRESHOLD) {
        sendAlert("error-rate-high", { errorsInLastSecond: state.errorsSinceLastTick });
    }
    state.errorsSinceLastTick = 0;

    roomOpsPerSec.clear();
    roomOpsSinceLastTick.forEach((count, shareId) => roomOpsPerSec.set(shareId, count));
    roomOpsSinceLastTick.clear();

    roomPresenceEventsPerSec.clear();
    roomPresenceEventsSinceLastTick.forEach((count, shareId) => roomPresenceEventsPerSec.set(shareId, count));
    roomPresenceEventsSinceLastTick.clear();
};

const startOpsPerSecTicker = () => setInterval(tickOpsPerSec, 1000);

// Rooms merged with their op and presence rates, busiest first. Callers pass what they hold
// (rooms, Redis memory) so this module owns no connections.
const getMetrics = ({ rooms, sockets, roomOccupancy, activeRooms = [], redisMemoryBytes = null }) => {
    const sortedLatencies = [...saveLatencySamples].sort((a, b) => a - b);
    return {
        errors: state.errors,
        clientErrors: state.clientErrors,
        opsPerSec: state.opsPerSec,
        rooms,
        sockets,
        roomOccupancy,
        boardCapRejections: state.boardCapRejections,
        peakBoardOccupancy: state.peakBoardOccupancy,
        saveLatencyMs: {
            p50: percentile(sortedLatencies, 0.5),
            p95: percentile(sortedLatencies, 0.95),
            max: sortedLatencies.length ? sortedLatencies[sortedLatencies.length - 1] : 0,
            samples: sortedLatencies.length,
        },
        saveFailures: state.saveFailures,
        ai: {
            generationsToday: state.aiGenerations,
            failuresToday: state.aiFailures,
            modelCallsToday: state.aiModelCalls,
            tokensApproxToday: state.aiTokensApprox,
            turns: {
                byOutcome: aiTurnStats.byOutcome,
                byErrorType: aiTurnStats.byErrorType,
                inputTokens: aiTurnStats.inputTokens,
                outputTokens: aiTurnStats.outputTokens,
                flaggedByGuards: aiTurnStats.flagged,
                fallbackModelUsed: aiTurnStats.fallbacks,
                latencyP50Ms: turnLatencyPercentile(0.5),
                latencyP95Ms: turnLatencyPercentile(0.95),
            },
            agentStageLatencyMs: Object.fromEntries(
                [...agentStageTotals.entries()].map(([stage, { count, totalMs }]) => [stage, { count, avgMs: Math.round(totalMs / count) }]),
            ),
        },
        grounding: {
            resolutionResolvedToday: state.resolutionResolved,
            resolutionAmbiguousToday: state.resolutionAmbiguous,
            resolutionNoneToday: state.resolutionNone,
            sanitizationDropsToday: state.sanitizationDrops,
            lintBlocksToday: state.lintBlocks,
        },
        resourceUsage: {
            rssBytes: process.memoryUsage().rss,
            heapUsedBytes: process.memoryUsage().heapUsed,
            redisMemoryBytes,
        },
        activeRooms: activeRooms
            .map(({ shareId, occupancy }) => ({
                shareId,
                occupancy,
                opsPerSec: roomOpsPerSec.get(shareId) || 0,
                presenceEventsPerSec: roomPresenceEventsPerSec.get(shareId) || 0,
            }))
            .sort((a, b) => b.occupancy - a.occupancy),
    };
};

// Test-only: process-lifetime counters otherwise leak state across test
// cases sharing this module.
const _resetForTests = () => {
    state.errors = 0;
    state.opsSinceLastTick = 0;
    state.opsPerSec = 0;
    state.boardCapRejections = 0;
    state.peakBoardOccupancy = 0;
    state.saveFailures = 0;
    state.clientErrors = 0;
    state.aiGenerations = 0;
    state.aiFailures = 0;
    state.errorsSinceLastTick = 0;
    state.aiModelCalls = 0;
    state.aiTokensApprox = 0;
    state.resolutionResolved = 0;
    state.resolutionAmbiguous = 0;
    state.resolutionNone = 0;
    state.sanitizationDrops = 0;
    state.lintBlocks = 0;
    saveLatencySamples = [];
    roomOpsSinceLastTick.clear();
    roomOpsPerSec.clear();
    roomPresenceEventsSinceLastTick.clear();
    roomPresenceEventsPerSec.clear();
    agentStageTotals.clear();
    Object.assign(aiTurnStats, { byOutcome: {}, byErrorType: {}, inputTokens: 0, outputTokens: 0, flagged: 0, fallbacks: 0, latencySamples: [] });
};

export {
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
    recordAiTurn,
    recordAiModelCall,
    recordResolutionOutcome,
    recordSanitizationDrop,
    recordLintBlock,
    recordAgentStageTiming,
    tickOpsPerSec,
    startOpsPerSecTicker,
    getMetrics,
    _resetForTests,
};
