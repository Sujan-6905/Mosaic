import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../../auth/sessionTokens.js", () => ({ refreshSession: vi.fn(), endSession: vi.fn() }));

const { refreshSession, endSession } = await import("../../../auth/sessionTokens.js");
const { default: sessionRoutes } = await import("../../routes/sessionRoutes.js");

const app = express();
app.use(express.json());
app.use("/api/auth/session", sessionRoutes);

const REFRESH_TOKEN = "r".repeat(43);

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /api/auth/session/refresh", () => {
    it("returns the new pair", async () => {
        refreshSession.mockResolvedValue({ token: "access", refreshToken: "next", accessTokenExpiresAt: 1 });
        const res = await request(app).post("/api/auth/session/refresh").send({ refreshToken: REFRESH_TOKEN });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ token: "access", refreshToken: "next", accessTokenExpiresAt: 1 });
        expect(refreshSession).toHaveBeenCalledWith(REFRESH_TOKEN);
    });

    it("answers 401 when the sign-in has ended", async () => {
        refreshSession.mockResolvedValue(null);
        const res = await request(app).post("/api/auth/session/refresh").send({ refreshToken: REFRESH_TOKEN });
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("session_ended");
    });

    it("rejects a body without a plausible token before touching the store", async () => {
        const res = await request(app).post("/api/auth/session/refresh").send({ refreshToken: "x" });
        expect(res.status).toBe(400);
        expect(refreshSession).not.toHaveBeenCalled();
    });
});

describe("POST /api/auth/session/end", () => {
    it("ends the sign-in and succeeds even when the store fails", async () => {
        endSession.mockRejectedValueOnce(new Error("store down"));
        const res = await request(app).post("/api/auth/session/end").send({ refreshToken: REFRESH_TOKEN });
        expect(res.status).toBe(204);
        expect(endSession).toHaveBeenCalledWith(REFRESH_TOKEN);
    });
});
