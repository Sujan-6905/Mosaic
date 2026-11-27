import { describe, it, expect, vi } from "vitest";

vi.mock("../../observability/logger.js", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { createDbWatchdog } = await import("../watchdog.js");

const unhealthy = { healthy: false, error: "kv: timeout" };

const build = (results) => {
    const check = vi.fn();
    results.forEach((result) => check.mockResolvedValueOnce(result));
    const reconnect = vi.fn().mockResolvedValue();
    const onUnhealthy = vi.fn();
    return { watchdog: createDbWatchdog({ check, reconnect, onUnhealthy }), check, reconnect, onUnhealthy };
};

const tickTimes = async (watchdog, times) => {
    for (let i = 0; i < times; i += 1) await watchdog.tick();
};

describe("createDbWatchdog", () => {
    it("leaves a healthy connection alone", async () => {
        const { watchdog, reconnect, onUnhealthy } = build([{ healthy: true }, { healthy: true }]);
        await tickTimes(watchdog, 2);
        expect(reconnect).not.toHaveBeenCalled();
        expect(onUnhealthy).not.toHaveBeenCalled();
    });

    it("gives the SDK time to recover from a blip before replacing anything", async () => {
        const { watchdog, reconnect, onUnhealthy } = build([unhealthy, unhealthy, { healthy: true }, unhealthy, unhealthy, { healthy: true }]);
        await tickTimes(watchdog, 6);
        expect(onUnhealthy).toHaveBeenCalledTimes(4);
        expect(reconnect).not.toHaveBeenCalled();
    });

    it("replaces the connection once failures persist, and starts counting afresh", async () => {
        const { watchdog, reconnect } = build([unhealthy, unhealthy, unhealthy, unhealthy, { healthy: true }]);
        await tickTimes(watchdog, 3);
        expect(reconnect).toHaveBeenCalledTimes(1);
        await tickTimes(watchdog, 2);
        expect(reconnect).toHaveBeenCalledTimes(1);
    });

    it("keeps trying when the replacement fails because the database really is down", async () => {
        const { watchdog, reconnect } = build([unhealthy, unhealthy, unhealthy, unhealthy]);
        reconnect.mockRejectedValueOnce(new Error("unreachable"));
        await tickTimes(watchdog, 4);
        expect(reconnect).toHaveBeenCalledTimes(2);
    });

    it("never overlaps a check that is still running", async () => {
        let release;
        const check = vi.fn(
            () =>
                new Promise((resolve) => {
                    release = () => resolve({ healthy: true });
                }),
        );
        const watchdog = createDbWatchdog({ check, reconnect: vi.fn(), onUnhealthy: vi.fn() });
        const first = watchdog.tick();
        await watchdog.tick();
        expect(check).toHaveBeenCalledTimes(1);
        release();
        await first;
    });
});
