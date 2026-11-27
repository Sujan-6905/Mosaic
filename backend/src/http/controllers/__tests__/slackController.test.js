import crypto from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../../models/drawingSchema.js", () => ({ default: { findOne: vi.fn() } }));
const { slackEvents } = await import("../slackController.js");

const app = express();
app.post("/events", express.raw({ type: "application/json" }), slackEvents);

const sign = (body, timestamp = Math.floor(Date.now() / 1000)) => ({
    "x-slack-request-timestamp": String(timestamp),
    "x-slack-signature": `v0=${crypto.createHmac("sha256", "slack-secret").update(`v0:${timestamp}:${body}`).digest("hex")}`,
});

beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = "slack-secret";
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
});

describe("Slack events", () => {
    const body = JSON.stringify({ type: "url_verification", challenge: "abc" });

    it("answers Slack's URL check when signed", async () => {
        const res = await request(app).post("/events").set("Content-Type", "application/json").set(sign(body)).send(body);
        expect(res.body.challenge).toBe("abc");
    });

    it("refuses unsigned, wrongly signed and replayed requests", async () => {
        expect((await request(app).post("/events").set("Content-Type", "application/json").send(body)).status).toBe(401);
        expect(
            (
                await request(app)
                    .post("/events")
                    .set("Content-Type", "application/json")
                    .set({ ...sign(body), "x-slack-signature": "v0=00" })
                    .send(body)
            ).status,
        ).toBe(401);
        const old = Math.floor(Date.now() / 1000) - 3600;
        expect((await request(app).post("/events").set("Content-Type", "application/json").set(sign(body, old)).send(body)).status).toBe(401);
    });

    it("isn't there at all until a Slack app is configured", async () => {
        delete process.env.SLACK_BOT_TOKEN;
        expect((await request(app).post("/events").set("Content-Type", "application/json").set(sign(body)).send(body)).status).toBe(404);
    });
});
