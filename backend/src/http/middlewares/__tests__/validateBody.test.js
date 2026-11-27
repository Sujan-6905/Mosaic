import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import validateBody from "../validateBody.js";

const schema = z.object({ name: z.string().min(1).max(20) });

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/echo", validateBody(schema), (req, res) => res.status(200).json({ body: req.body }));
    return app;
};

describe("validateBody", () => {
    it("calls next() and passes the parsed body through on a valid payload", async () => {
        const res = await request(buildApp()).post("/echo").send({ name: "Ada" });
        expect(res.status).toBe(200);
        expect(res.body.body).toEqual({ name: "Ada" });
    });

    it("strips fields the schema doesn't declare instead of erroring", async () => {
        const res = await request(buildApp()).post("/echo").send({ name: "Ada", extra: "ignored" });
        expect(res.status).toBe(200);
        expect(res.body.body).toEqual({ name: "Ada" });
    });

    it("returns 400 with per-field errors on an invalid payload", async () => {
        const res = await request(buildApp()).post("/echo").send({ name: "" });
        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: "name" })]));
    });

    it("returns 400 when a required field is missing entirely", async () => {
        const res = await request(buildApp()).post("/echo").send({});
        expect(res.status).toBe(400);
    });
});
