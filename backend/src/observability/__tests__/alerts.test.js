import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendAlert, _resetForTests } from "../alerts.js";
import logger from "../logger.js";

beforeEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.spyOn(logger, "fatal").mockImplementation(() => {});
});

afterEach(() => {
    delete process.env.ALERT_WEBHOOK_URL;
});

describe("sendAlert", () => {
    it("always logs at fatal level, with no webhook configured", () => {
        sendAlert("db-unavailable", { error: "timeout" });

        expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining({ kind: "db-unavailable", error: "timeout" }), "alert condition triggered");
    });

    it("suppresses a repeat of the same kind within the cooldown window", () => {
        sendAlert("db-unavailable", {});
        sendAlert("db-unavailable", {});

        expect(logger.fatal).toHaveBeenCalledTimes(1);
    });

    it("does not suppress a different kind during another kind's cooldown", () => {
        sendAlert("db-unavailable", {});
        sendAlert("redis-unavailable", {});

        expect(logger.fatal).toHaveBeenCalledTimes(2);
    });

    it("posts to ALERT_WEBHOOK_URL when configured", async () => {
        process.env.ALERT_WEBHOOK_URL = "https://example.com/webhook";
        const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true });

        sendAlert("save-failure", { shareId: "abc123" });
        await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

        expect(fetchSpy).toHaveBeenCalledWith("https://example.com/webhook", expect.objectContaining({ method: "POST" }));
    });

    it("logs (but does not throw) if the webhook delivery itself fails", async () => {
        process.env.ALERT_WEBHOOK_URL = "https://example.com/webhook";
        vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
        vi.spyOn(logger, "error").mockImplementation(() => {});

        expect(() => sendAlert("save-failure", {})).not.toThrow();
        await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    });
});
