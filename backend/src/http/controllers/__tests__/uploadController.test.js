import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("cloudinary", () => ({
    v2: {
        utils: {
            api_sign_request: vi.fn(() => "signed-signature"),
        },
    },
}));

const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { getCloudinarySignature } = await import("../uploadController.js");

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.get("/api/upload/cloudinary-signature", authCheck, getCloudinarySignature);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);

const originalEnv = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

afterEach(() => {
    Object.assign(process.env, originalEnv);
});

describe("GET /api/upload/cloudinary-signature", () => {
    it("returns 503 when Cloudinary isn't configured", async () => {
        delete process.env.CLOUDINARY_CLOUD_NAME;
        delete process.env.CLOUDINARY_API_KEY;
        delete process.env.CLOUDINARY_API_SECRET;

        const res = await request(buildApp()).get("/api/upload/cloudinary-signature").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(503);
    });

    it("returns a signed payload when configured", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
        process.env.CLOUDINARY_API_KEY = "demo-key";
        process.env.CLOUDINARY_API_SECRET = "demo-secret";

        const res = await request(buildApp()).get("/api/upload/cloudinary-signature").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ cloudName: "demo-cloud", apiKey: "demo-key", signature: "signed-signature" });
        expect(res.body.timestamp).toEqual(expect.any(Number));
    });

    it("refuses a read-only token, since a signature is a write to the image store", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
        process.env.CLOUDINARY_API_KEY = "demo-key";
        process.env.CLOUDINARY_API_SECRET = "demo-secret";
        const readOnly = jwt.sign({ userId: "user-1", scope: "read" }, process.env.JWT_SECRET);

        const res = await request(buildApp()).get("/api/upload/cloudinary-signature").set("Authorization", `Bearer ${readOnly}`);

        expect(res.status).toBe(403);
    });

    it("rejects an unauthenticated request", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
        process.env.CLOUDINARY_API_KEY = "demo-key";
        process.env.CLOUDINARY_API_SECRET = "demo-secret";

        const res = await request(buildApp()).get("/api/upload/cloudinary-signature");

        expect(res.status).toBe(401);
    });
});
