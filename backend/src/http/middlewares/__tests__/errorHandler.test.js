import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import errorHandler from "../errorHandler.js";
import { getMetrics, _resetForTests } from "../../../observability/metrics.js";
import logger from "../../../observability/logger.js";

const buildApp = () => {
    const app = express();
    app.get("/boom-sync", () => {
        throw new Error("sync failure");
    });
    app.get("/boom-async", async (req, res, next) => {
        try {
            await Promise.reject(new Error("async failure"));
        } catch (error) {
            next(error);
        }
    });
    app.post("/json", express.json({ limit: "1kb" }), (req, res) => res.status(200).json({ ok: true }));
    app.use(errorHandler);
    return app;
};

beforeEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.spyOn(logger, "error").mockImplementation(() => {});
});

describe("errorHandler", () => {
    it("returns a clean 500 JSON response for a synchronously thrown error, without leaking the stack trace", async () => {
        const res = await request(buildApp()).get("/boom-sync");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: "Internal server error" });
        expect(JSON.stringify(res.body)).not.toContain("sync failure");
    });

    it("also catches an error passed via next(err) from an async handler", async () => {
        const res = await request(buildApp()).get("/boom-async");
        expect(res.status).toBe(500);
    });

    it("logs the error and increments the metrics error counter", async () => {
        await request(buildApp()).get("/boom-sync");

        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(getMetrics({ rooms: 0, sockets: 0 }).errors).toBe(1);
    });
});

describe("errorHandler with bad request bodies", () => {
    it("answers malformed JSON with 400 and doesn't count it as a server error", async () => {
        const res = await request(buildApp()).post("/json").set("Content-Type", "application/json").send("{not json");
        expect(res.status).toBe(400);
        expect(getMetrics({ rooms: 0, sockets: 0, roomOccupancy: 0 }).errors).toBe(0);
    });

    it("answers an oversized body with 413", async () => {
        const res = await request(buildApp())
            .post("/json")
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ text: "x".repeat(4000) }));
        expect(res.status).toBe(413);
    });
});
