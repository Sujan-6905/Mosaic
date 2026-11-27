import { describe, it, expect, vi, beforeEach } from "vitest";
import safeHandler from "../safeHandler.js";
import { getMetrics, _resetForTests } from "../../../observability/metrics.js";

const buildFakeSocket = () => ({
    id: "socket-1",
    log: { error: vi.fn() },
});

beforeEach(() => {
    _resetForTests();
});

describe("safeHandler", () => {
    it("calls through to the wrapped handler with its arguments on success", async () => {
        const socket = buildFakeSocket();
        const handler = vi.fn().mockResolvedValue(undefined);
        const wrapped = safeHandler(socket, "client:test", handler);

        await wrapped({ a: 1 }, "extra");

        expect(handler).toHaveBeenCalledWith({ a: 1 }, "extra");
        expect(socket.log.error).not.toHaveBeenCalled();
        expect(getMetrics({ rooms: 0, sockets: 0 }).errors).toBe(0);
    });

    it("catches a synchronous throw instead of letting it escape as an unhandled exception", async () => {
        const socket = buildFakeSocket();
        const handler = () => {
            throw new Error("boom");
        };
        const wrapped = safeHandler(socket, "client:test", handler);

        await expect(wrapped({})).resolves.toBeUndefined();
        expect(socket.log.error).toHaveBeenCalledTimes(1);
    });

    it("catches a rejected async handler instead of leaving an unhandled rejection", async () => {
        const socket = buildFakeSocket();
        const handler = async () => {
            throw new Error("async boom");
        };
        const wrapped = safeHandler(socket, "client:updateCanvas", handler);

        await expect(wrapped({})).resolves.toBeUndefined();
        expect(socket.log.error).toHaveBeenCalledWith(expect.objectContaining({ event: "client:updateCanvas" }), expect.any(String));
    });

    it("increments the metrics error counter on a caught exception", async () => {
        const socket = buildFakeSocket();
        const wrapped = safeHandler(socket, "client:test", () => {
            throw new Error("boom");
        });

        await wrapped({});
        await wrapped({});

        expect(getMetrics({ rooms: 0, sockets: 0 }).errors).toBe(2);
    });
});
