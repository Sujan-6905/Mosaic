import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import correlationId from "../correlationId.js";

const buildApp = () => {
    const app = express();
    // pino-http normally supplies req.id: stubbed here so this test doesn't
    // depend on that middleware's own id-generation scheme.
    app.use((req, res, next) => {
        req.id = "generated-id";
        next();
    });
    app.use(correlationId);
    app.get("/", (req, res) => res.json({ correlationId: req.correlationId }));
    return app;
};

describe("correlationId middleware", () => {
    it("uses the client-supplied X-Correlation-Id header when present", async () => {
        const res = await request(buildApp()).get("/").set("X-Correlation-Id", "client-id-123");

        expect(res.body.correlationId).toBe("client-id-123");
        expect(res.headers["x-correlation-id"]).toBe("client-id-123");
    });

    it("falls back to req.id when no header is sent", async () => {
        const res = await request(buildApp()).get("/");

        expect(res.body.correlationId).toBe("generated-id");
        expect(res.headers["x-correlation-id"]).toBe("generated-id");
    });

    it("ignores a non-string header value", async () => {
        const res = await request(buildApp()).get("/").set("X-Correlation-Id", "");

        expect(res.body.correlationId).toBe("generated-id");
    });
});
