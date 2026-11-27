// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronRequest, wakeBackendAndDatabase } from "../databaseKeepAlive";

const reply = (status, body) => new Response(body, { status });

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("database keep-alive", () => {
    it("accepts only the cron secret, and nothing when none is set", () => {
        expect(isCronRequest("Bearer s3cret", "s3cret")).toBe(true);
        expect(isCronRequest("Bearer wrong", "s3cret")).toBe(false);
        expect(isCronRequest(undefined, "s3cret")).toBe(false);
        expect(isCronRequest("Bearer undefined", undefined)).toBe(false);
    });

    it("retries past a loading page and a degraded database until the backend reports ok", async () => {
        vi.useFakeTimers();
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(reply(200, "<html>starting</html>"))
            .mockResolvedValueOnce(reply(503, '{"status":"degraded"}'))
            .mockResolvedValueOnce(reply(200, '{"status":"ok"}'));
        vi.stubGlobal("fetch", fetch);
        const result = wakeBackendAndDatabase("https://backend.example/");
        await vi.runAllTimersAsync();
        expect(await result).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[0][0]).toBe("https://backend.example/healthz");
    });

    it("gives up when the backend never answers", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
        const result = wakeBackendAndDatabase("https://backend.example");
        await vi.runAllTimersAsync();
        expect(await result).toBe(false);
    });
});
