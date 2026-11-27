import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const findOne = vi.fn();
const notify = vi.fn();
const hasPendingRequest = vi.fn();
vi.mock("../../../models/drawingSchema.js", () => ({ default: { findOne: (...args) => findOne(...args) } }));
vi.mock("../../../services/boards.js", () => ({ getUsername: vi.fn(async (userId) => `name-of-${userId}`) }));
vi.mock("../../../services/notifications.js", () => ({
    notify: (...args) => notify(...args),
    hasPendingRequest: (...args) => hasPendingRequest(...args),
    listNotifications: vi.fn(),
    markNotificationsRead: vi.fn(),
}));
vi.mock("ottoman", () => ({ getCollection: vi.fn(), getDefaultInstance: vi.fn() }));
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { requestAccess } = await import("../notificationController.js");

const app = express();
app.post("/api/notifications/access-request/:shareId", authCheck, requestAccess);
const token = jwt.sign({ userId: "asker" }, process.env.JWT_SECRET);
const ask = (shareId = "b1") => request(app).post(`/api/notifications/access-request/${shareId}`).set("Authorization", `Bearer ${token}`);

const privateBoard = (extra = {}) => ({ shareId: "b1", title: "Secret plan", owner: "owner", getRole: vi.fn(() => null), ...extra });

beforeEach(() => {
    vi.clearAllMocks();
    hasPendingRequest.mockResolvedValue(false);
});

describe("asking for access", () => {
    it("tells the owner who asked, without telling the asker anything about the board", async () => {
        findOne.mockResolvedValue(privateBoard());
        const res = await ask();
        expect(res.status).toBe(202);
        expect(JSON.stringify(res.body)).not.toContain("Secret plan");
        expect(notify).toHaveBeenCalledWith(
            "owner",
            expect.objectContaining({ kind: "accessRequest", shareId: "b1", actorId: "asker", actorName: "name-of-asker" }),
        );
    });

    it("asks only once a day for the same board", async () => {
        findOne.mockResolvedValue(privateBoard());
        hasPendingRequest.mockResolvedValue(true);
        expect((await ask()).status).toBe(202);
        expect(notify).not.toHaveBeenCalled();
    });

    it("refuses someone who can already open the board", async () => {
        findOne.mockResolvedValue(privateBoard({ getRole: vi.fn(() => "viewer") }));
        expect((await ask()).status).toBe(409);
        expect(notify).not.toHaveBeenCalled();
    });

    it("says when the board doesn't exist", async () => {
        findOne.mockResolvedValue(null);
        expect((await ask("nope")).status).toBe(404);
    });
});
