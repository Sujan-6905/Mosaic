import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { authLimiter, aiLimiter, aiTurnLimiter, clientErrorLimiter } from "../rateLimiters.js";

const buildApp = (limiter) => {
    const app = express();
    app.use(limiter);
    app.get("/ping", (req, res) => res.status(200).json({ ok: true }));
    return app;
};

describe("authLimiter", () => {
    it("allows the first 10 requests/min/IP and rejects the 11th with 429", async () => {
        const app = buildApp(authLimiter);

        for (let i = 0; i < 10; i++) {
            const res = await request(app).get("/ping");
            expect(res.status).toBe(200);
        }

        const eleventh = await request(app).get("/ping");
        expect(eleventh.status).toBe(429);
    });
});

describe("aiLimiter", () => {
    it("allows the first 60 requests/min/IP and rejects the 61st with 429", async () => {
        const app = buildApp(aiLimiter);

        for (let i = 0; i < 60; i++) {
            const res = await request(app).get("/ping");
            expect(res.status).toBe(200);
        }

        const eleventh = await request(app).get("/ping");
        expect(eleventh.status).toBe(429);
    });
});

describe("aiTurnLimiter", () => {
    it("counts per signed-in user, so one person's flood doesn't block a colleague on the same network", async () => {
        const app = express();
        app.use((req, res, next) => {
            req.user = { userId: req.get("x-test-user") };
            next();
        });
        app.use(aiTurnLimiter);
        app.get("/ping", (req, res) => res.status(200).json({ ok: true }));

        for (let i = 0; i < 15; i++) await request(app).get("/ping").set("x-test-user", "flooder");

        expect((await request(app).get("/ping").set("x-test-user", "flooder")).status).toBe(429);
        expect((await request(app).get("/ping").set("x-test-user", "colleague")).status).toBe(200);
    });
});

describe("clientErrorLimiter", () => {
    it("allows the first 30 requests/min/IP and rejects the 31st with 429", async () => {
        const app = buildApp(clientErrorLimiter);

        for (let i = 0; i < 30; i++) {
            const res = await request(app).get("/ping");
            expect(res.status).toBe(200);
        }

        const thirtyFirst = await request(app).get("/ping");
        expect(thirtyFirst.status).toBe(429);
    });
});
