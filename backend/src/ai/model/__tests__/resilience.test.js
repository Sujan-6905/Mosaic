import { describe, it, expect, vi, beforeEach } from "vitest";
import { callWithResilience, openBreakers, resetBreakersForTests } from "../resilience.js";
import { ProviderError } from "../provider.js";

const deadlineAt = () => Date.now() + 30_000;
const failure = (code, extra = {}) => new ProviderError({ code, ...extra });

describe("callWithResilience", () => {
    beforeEach(() => resetBreakersForTests());

    it("returns the first success without touching the fallback", async () => {
        const call = vi.fn().mockResolvedValue("ok");
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() })).resolves.toBe("ok");
        expect(call).toHaveBeenCalledTimes(1);
    });

    it("retries a transient failure on the same model", async () => {
        const call = vi.fn().mockRejectedValueOnce(failure("unavailable")).mockResolvedValueOnce("ok");
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() })).resolves.toBe("ok");
        expect(call.mock.calls.map(([model]) => model)).toEqual(["a", "a"]);
    });

    it("moves to the fallback rather than sit through a long retry-after", async () => {
        const call = vi
            .fn()
            .mockRejectedValueOnce(failure("rate_limited", { retryAfterMs: 60_000 }))
            .mockResolvedValueOnce("ok");
        await callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() });
        expect(call.mock.calls.map(([model]) => model)).toEqual(["a", "b"]);
    });

    it("tries the next model, not the same one, after invalid output", async () => {
        const call = vi.fn().mockRejectedValueOnce(failure("invalid_output")).mockResolvedValueOnce("ok");
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() })).resolves.toBe("ok");
        expect(call.mock.calls.map(([model]) => model)).toEqual(["a", "b"]);
    });

    it("moves to the next model when one rejects the request, since another may accept it", async () => {
        const call = vi.fn().mockRejectedValueOnce(failure("bad_request")).mockResolvedValueOnce("ok");
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() })).resolves.toBe("ok");
        expect(call.mock.calls.map(([model]) => model)).toEqual(["a", "b"]);
    });

    it.each(["too_large", "auth"])("doesn't retry %s, which would fail the same way", async (code) => {
        const call = vi.fn().mockRejectedValue(failure(code));
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() })).rejects.toMatchObject({ code });
        expect(call).toHaveBeenCalledTimes(1);
    });

    it("turns a network error into an unavailable failure", async () => {
        const call = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
        await expect(callWithResilience({ models: ["a"], call, deadlineAt: deadlineAt() })).rejects.toMatchObject({ code: "unavailable" });
    });

    it("opens the breaker after repeated outages, then skips that model", async () => {
        const call = vi.fn().mockRejectedValue(failure("unavailable", { retryAfterMs: 1 }));
        for (let i = 0; i < 3; i++) await callWithResilience({ models: ["a"], call, deadlineAt: deadlineAt() }).catch(() => {});
        expect(openBreakers()).toContain("a");

        call.mockClear();
        call.mockResolvedValue("ok");
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt() })).resolves.toBe("ok");
        expect(call.mock.calls.map(([model]) => model)).toEqual(["b"]);
    });

    it("doesn't let rate limits open the breaker: the provider is healthy and saying no", async () => {
        const call = vi.fn().mockRejectedValue(failure("rate_limited", { retryAfterMs: 60_000 }));
        for (let i = 0; i < 8; i++) await callWithResilience({ models: ["a"], call, deadlineAt: deadlineAt() }).catch(() => {});
        expect(openBreakers()).not.toContain("a");
    });

    it("stops at the turn's deadline", async () => {
        const call = vi.fn();
        await expect(callWithResilience({ models: ["a"], call, deadlineAt: Date.now() - 1 })).rejects.toMatchObject({ code: "timeout" });
        expect(call).not.toHaveBeenCalled();
    });

    it("surfaces a user cancellation as an abort, without retrying", async () => {
        const controller = new AbortController();
        const call = vi.fn().mockImplementation(async () => {
            controller.abort();
            throw Object.assign(new Error("aborted"), { name: "AbortError" });
        });
        await expect(callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt(), signal: controller.signal })).rejects.toMatchObject({
            name: "AbortError",
        });
        expect(call).toHaveBeenCalledTimes(1);
    });

    it("reports each attempt, so a trace can show retries and fallbacks", async () => {
        const onAttempt = vi.fn();
        const call = vi
            .fn()
            .mockRejectedValueOnce(failure("rate_limited", { retryAfterMs: 60_000 }))
            .mockResolvedValueOnce("ok");
        await callWithResilience({ models: ["a", "b"], call, deadlineAt: deadlineAt(), onAttempt });
        expect(onAttempt.mock.calls.map(([attempt]) => [attempt.model, Boolean(attempt.error)])).toEqual([
            ["a", true],
            ["b", false],
        ]);
    });
});
