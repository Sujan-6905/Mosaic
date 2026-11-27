import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryUntilDone } from "../retryUntilDone.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("retryUntilDone", () => {
    it("returns after a failed first attempt and keeps trying until the task succeeds", async () => {
        const task = vi.fn().mockRejectedValueOnce(new Error("busy")).mockRejectedValueOnce(new Error("busy")).mockResolvedValue();
        const onFailure = vi.fn();
        await retryUntilDone(task, onFailure);
        expect(task).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(task).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(task).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(60 * 60_000);
        expect(task).toHaveBeenCalledTimes(3);
        expect(onFailure.mock.calls.map(([, details]) => details.retryInMs)).toEqual([15_000, 30_000]);
    });

    it("never waits longer than five minutes between attempts", async () => {
        const onFailure = vi.fn();
        await retryUntilDone(vi.fn().mockRejectedValue(new Error("down")), onFailure);
        await vi.advanceTimersByTimeAsync(60 * 60_000);
        expect(Math.max(...onFailure.mock.calls.map(([, details]) => details.retryInMs))).toBe(300_000);
    });
});
