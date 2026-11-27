import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import validateBody from "../../middlewares/validateBody.js";
import { clientErrorSchema } from "../../../validation/restSchemas.js";
import { reportClientError } from "../clientErrorController.js";
import { getMetrics, _resetForTests } from "../../../observability/metrics.js";
import logger from "../../../observability/logger.js";

// Mirrors the real route wiring (clientErrorRoutes.js).
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/api/client-errors", validateBody(clientErrorSchema), reportClientError);
    return app;
};

beforeEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("reportClientError", () => {
    it("accepts a minimal report and responds 204", async () => {
        const res = await request(buildApp()).post("/api/client-errors").send({ message: "boom" });

        expect(res.status).toBe(204);
    });

    it("logs the error with its correlation id and increments the client-error metric", async () => {
        await request(buildApp()).post("/api/client-errors").send({ message: "canvas crashed", stack: "at foo (bar.js:1:1)", correlationId: "abc-123" });

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ correlationId: "abc-123", stack: "at foo (bar.js:1:1)" }),
            "client error: canvas crashed",
        );
        expect(getMetrics({ rooms: 0, sockets: 0 }).clientErrors).toBe(1);
    });

    it("rejects a report with no message", async () => {
        const res = await request(buildApp()).post("/api/client-errors").send({});
        expect(res.status).toBe(400);
    });

    it("rejects a stack trace over the 8000-character bound", async () => {
        const res = await request(buildApp())
            .post("/api/client-errors")
            .send({ message: "boom", stack: "x".repeat(8001) });

        expect(res.status).toBe(400);
    });
});
