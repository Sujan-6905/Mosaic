import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../../models/letterSchema.js", () => ({ default: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), removeById: vi.fn() } }));
vi.mock("../../../models/drawingSchema.js", () => ({ default: { findOne: vi.fn(), findById: vi.fn() } }));
vi.mock("../../../services/boards.js", () => ({ getUsername: vi.fn(async () => "sujan") }));
vi.mock("../../../services/boardReel.js", () => ({ loadReel: vi.fn(async () => ({ latestSeq: 3, frames: [] })) }));

const Letter = (await import("../../../models/letterSchema.js")).default;
const Drawing = (await import("../../../models/drawingSchema.js")).default;
const letterRoutes = (await import("../letterRoutes.js")).default;

const app = () => {
    const server = express();
    server.use(express.json());
    server.use("/api/letters", letterRoutes);
    return server;
};

const owner = jwt.sign({ userId: "owner-1" }, process.env.JWT_SECRET);
const stranger = jwt.sign({ userId: "someone" }, process.env.JWT_SECRET);
const TOKEN = "abcdefghij_-1234";
const board = (extra = {}) => ({
    _id: "d1",
    shareId: "share-1",
    owner: "owner-1",
    title: "Plan",
    hasDeleteAccess: (who) => who.userId === "owner-1",
    ...extra,
});

beforeEach(() => {
    vi.clearAllMocks();
    Drawing.findOne.mockResolvedValue(board());
    Letter.find.mockResolvedValue({ rows: [] });
});

describe("letters", () => {
    it("are written only by the board's owner", async () => {
        Letter.create.mockImplementation(async (fields) => ({ ...fields, createdAt: "2026-11-18T00:00:00Z" }));

        const mine = await request(app()).post("/api/letters/board/share-1").set("Authorization", `Bearer ${owner}`).send({ company: "Acme" });
        const theirs = await request(app()).post("/api/letters/board/share-1").set("Authorization", `Bearer ${stranger}`).send({ company: "Acme" });

        expect(mine.status).toBe(201);
        expect(mine.body.letter).toMatchObject({ company: "Acme", token: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/) });
        expect(theirs.status).toBe(403);
    });

    it("open for anyone holding the link, showing the replay but nothing else of the board", async () => {
        Letter.findOne.mockResolvedValue({ token: TOKEN, shareId: "share-1", ownerId: "owner-1", company: "Acme", note: "Hi" });

        const res = await request(app()).get(`/api/letters/${TOKEN}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ company: "Acme", note: "Hi", title: "Plan", from: "sujan", reel: { latestSeq: 3, frames: [] } });
    });

    it("close when the board is swept away", async () => {
        Letter.findOne.mockResolvedValue({ token: TOKEN, shareId: "share-1", ownerId: "owner-1", company: "Acme" });
        Drawing.findOne.mockResolvedValue(board({ deletedAt: "2026-11-18T00:00:00Z" }));

        expect((await request(app()).get(`/api/letters/${TOKEN}`)).status).toBe(404);
    });

    it("are revoked only by the person who wrote them", async () => {
        Letter.findOne.mockResolvedValue({ _id: "l1", token: TOKEN, ownerId: "owner-1" });

        const theirs = await request(app()).delete(`/api/letters/${TOKEN}`).set("Authorization", `Bearer ${stranger}`);
        const mine = await request(app()).delete(`/api/letters/${TOKEN}`).set("Authorization", `Bearer ${owner}`);

        expect(theirs.status).toBe(404);
        expect(mine.status).toBe(200);
        expect(Letter.removeById).toHaveBeenCalledTimes(1);
    });
});
