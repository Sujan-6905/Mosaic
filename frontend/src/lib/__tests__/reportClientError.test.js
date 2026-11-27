import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../correlationId", () => ({
    getCorrelationId: () => "test-correlation-id",
}));

const { reportClientError, installGlobalErrorReporting } = await import("../reportClientError");

let fetchSpy;

beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:5000");
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("reportClientError", () => {
    it("posts to /api/client-errors with keepalive, so it survives a page unload", () => {
        reportClientError({ message: "canvas crashed", stack: "at foo" });

        expect(fetchSpy).toHaveBeenCalledWith("http://localhost:5000/api/client-errors", expect.objectContaining({ method: "POST", keepalive: true }));
    });

    it("sends no credentials, which the endpoint's CORS policy would refuse", () => {
        const sendBeacon = vi.fn();
        vi.stubGlobal("navigator", { sendBeacon });

        reportClientError({ message: "canvas crashed" });

        expect(sendBeacon).not.toHaveBeenCalled();
        expect(fetchSpy.mock.calls[0][1].credentials).toBeUndefined();
    });

    it("truncates an oversized message/stack rather than sending it unbounded", () => {
        reportClientError({ message: "x".repeat(5000), stack: "y".repeat(10000) });

        const payload = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(payload.message.length).toBe(2000);
        expect(payload.stack.length).toBe(8000);
    });
});

describe("installGlobalErrorReporting", () => {
    it("reports an uncaught error event", () => {
        installGlobalErrorReporting();
        window.dispatchEvent(Object.assign(new Event("error"), { message: "boom", error: new Error("boom") }));

        expect(fetchSpy).toHaveBeenCalled();
    });

    it("reports an unhandled promise rejection", () => {
        installGlobalErrorReporting();
        const event = new Event("unhandledrejection");
        event.reason = new Error("rejected");
        window.dispatchEvent(event);

        expect(fetchSpy).toHaveBeenCalled();
    });
});
