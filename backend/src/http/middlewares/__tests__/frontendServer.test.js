import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { requireFrontendServer, resolveClientIp } from "../frontendServer.js";

const KEY = "k".repeat(40);
const app = express();
app.post("/bridge", requireFrontendServer, (req, res) => res.status(200).json({ ok: true }));
app.get("/ip", resolveClientIp, (req, res) => res.status(200).json({ ip: req.clientIp }));

const original = process.env.FRONTEND_SERVER_KEY;
afterEach(() => {
    process.env.FRONTEND_SERVER_KEY = original;
});

describe("requireFrontendServer", () => {
    it("lets through only a request carrying the shared key", async () => {
        process.env.FRONTEND_SERVER_KEY = KEY;
        expect((await request(app).post("/bridge").set("x-mosaic-server-key", KEY)).status).toBe(200);
        expect((await request(app).post("/bridge").set("x-mosaic-server-key", "wrong")).status).toBe(403);
        expect((await request(app).post("/bridge")).status).toBe(403);
    });

    it("refuses everything when no key is configured, rather than trusting the caller", async () => {
        delete process.env.FRONTEND_SERVER_KEY;
        expect((await request(app).post("/bridge").set("x-mosaic-server-key", "")).status).toBe(503);
    });
});

describe("resolveClientIp", () => {
    it("believes the forwarded client address only alongside the shared key", async () => {
        process.env.FRONTEND_SERVER_KEY = KEY;
        const vouched = await request(app).get("/ip").set("x-mosaic-server-key", KEY).set("x-mosaic-client-ip", "203.0.113.7");
        expect(vouched.body.ip).toBe("203.0.113.7");
        const spoofed = await request(app).get("/ip").set("x-mosaic-client-ip", "203.0.113.7");
        expect(spoofed.body.ip).not.toBe("203.0.113.7");
    });

    it("ignores a forwarded value that isn't an address", async () => {
        process.env.FRONTEND_SERVER_KEY = KEY;
        const response = await request(app).get("/ip").set("x-mosaic-server-key", KEY).set("x-mosaic-client-ip", "not-an-ip");
        expect(response.body.ip).not.toBe("not-an-ip");
    });
});
