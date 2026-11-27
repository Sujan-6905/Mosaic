// Turns the board's frame counters into the percentile snapshot perf/run.mjs reads.

const FRAME_TIME_BUFFER_SIZE = 600;

// Bounded ring buffer push: O(1), never grows past `size`.
export const pushBounded = (buffer, value, size = FRAME_TIME_BUFFER_SIZE) => {
    buffer.push(value);
    if (buffer.length > size) buffer.shift();
    return buffer;
};

const percentile = (sortedValues, p) => {
    if (sortedValues.length === 0) return 0;
    const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
    return sortedValues[index];
};

// frameTimes: ms-per-frame samples. Returns the percentile figures the
// perf budgets (frontend/perf/BUDGETS.md) are stated in terms of.
export const summarizeFrameTimes = (frameTimes) => {
    if (frameTimes.length === 0) {
        return { count: 0, p50: 0, p95: 0, p99: 0, max: 0, avgFps: 0 };
    }
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const avg = frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length;
    return {
        count: frameTimes.length,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted[sorted.length - 1],
        avgFps: avg > 0 ? Math.round(1000 / avg) : 0,
    };
};

export const buildSnapshot = ({
    frameTimes,
    paintTimes = [],
    staticRepaints,
    staticInsertDrains,
    indexQueryTimes = [],
    socketMessageCount,
    visibleElementCount = null,
    totalElementCount = null,
}) => ({
    frameTime: summarizeFrameTimes(frameTimes),
    paintTime: summarizeFrameTimes(paintTimes),
    indexQueryTime: summarizeFrameTimes(indexQueryTimes),
    staticRepaints,
    staticInsertDrains,
    socketMessageCount,
    visibleElementCount,
    totalElementCount,
});
