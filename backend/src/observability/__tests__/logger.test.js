import { describe, it, expect } from "vitest";
import logger, { childLoggerForSocket, withoutSecretParams } from "../logger.js";

describe("childLoggerForSocket", () => {
    it("binds socketId and userId so every subsequent log line from that connection carries both", () => {
        const fakeSocket = { id: "socket-123", userId: "user-abc" };

        const child = childLoggerForSocket(fakeSocket);

        expect(child.bindings()).toEqual({ socketId: "socket-123", userId: "user-abc" });
    });

    it("is a genuine pino child logger, not a plain object - it still exposes the standard log methods", () => {
        const child = childLoggerForSocket({ id: "socket-1", userId: "user-1" });

        expect(typeof child.info).toBe("function");
        expect(typeof child.warn).toBe("function");
        expect(typeof child.error).toBe("function");
    });
});

describe("logger", () => {
    it("exposes the standard pino levels used across the backend", () => {
        expect(typeof logger.info).toBe("function");
        expect(typeof logger.warn).toBe("function");
        expect(typeof logger.error).toBe("function");
        expect(typeof logger.fatal).toBe("function");
    });
});

describe("withoutSecretParams", () => {
    it("keeps secrets passed in a query string out of the access log", () => {
        expect(withoutSecretParams("/admin/dashboard/metrics?token=s3cret&x=1")).toBe("/admin/dashboard/metrics?token=[redacted]&x=1");
        expect(withoutSecretParams("/oauth/callback?state=a&code=xyz")).toBe("/oauth/callback?state=a&code=[redacted]");
        expect(withoutSecretParams("/api/drawing/get")).toBe("/api/drawing/get");
    });
});
