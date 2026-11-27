import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import express from "express";
import request from "supertest";
import authCheck, { verifyToken } from "../authMiddleware.js";

// setup.js seeds JWT_SECRET before this module (and authMiddleware.js) load.
const SECRET = process.env.JWT_SECRET;

describe("verifyToken", () => {
    it("decodes a token signed with the correct secret", () => {
        const token = jwt.sign({ userId: "abc123" }, SECRET);
        expect(verifyToken(token).userId).toBe("abc123");
    });

    it("throws for a token signed with a different secret", () => {
        const token = jwt.sign({ userId: "abc123" }, "wrong-secret");
        expect(() => verifyToken(token)).toThrow();
    });

    it("throws for an expired token", () => {
        const token = jwt.sign({ userId: "abc123" }, SECRET, { expiresIn: -1 });
        expect(() => verifyToken(token)).toThrow(/expired/i);
    });

    it("throws for a malformed token", () => {
        expect(() => verifyToken("not-a-real-token")).toThrow();
    });
});

describe("authCheck", () => {
    const app = express();
    app.use(express.json());
    app.all("/thing", authCheck, (req, res) => res.json(req.user));

    it("lets a read-only token read and refuses it anything else", async () => {
        const readOnly = jwt.sign({ userId: "u1", scope: "read" }, SECRET);
        expect((await request(app).get("/thing").set("Authorization", `Bearer ${readOnly}`)).status).toBe(200);
        const write = await request(app).post("/thing").set("Authorization", `Bearer ${readOnly}`);
        expect(write.status).toBe(403);
        expect(write.body.code).toBe("read_only_token");
    });

    it("refuses a token signed with another algorithm", async () => {
        const none = jwt.sign({ userId: "u1" }, null, { algorithm: "none" });
        expect((await request(app).get("/thing").set("Authorization", `Bearer ${none}`)).status).toBe(401);
    });
});
