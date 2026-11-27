import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn() },
}));
vi.mock("../../../models/aiConversationSchema.js", () => ({
    default: {
        findOwned: vi.fn(),
        listForUser: vi.fn(),
        start: vi.fn(),
        removeById: vi.fn().mockResolvedValue(undefined),
    },
}));

const Drawing = (await import("../../../models/drawingSchema.js")).default;
const AiConversation = (await import("../../../models/aiConversationSchema.js")).default;
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { checkEditAccess, checkViewAccess } = await import("../../middlewares/checkAccess.js");
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { aiConversationCreateSchema, aiConversationRenameSchema } = await import("../../../validation/restSchemas.js");
const { listConversations, createConversation, getConversation, renameConversation, deleteConversation } = await import("../aiConversationController.js");

// Mirrors the real route wiring (aiRoutes.js).
const buildApp = () =>
    express()
        .use(express.json())
        .get("/api/ai/:shareId/conversations", authCheck, checkViewAccess, listConversations)
        .post("/api/ai/:shareId/conversations", authCheck, checkEditAccess, validateBody(aiConversationCreateSchema), createConversation)
        .get("/api/ai/:shareId/conversations/:conversationId", authCheck, checkViewAccess, getConversation)
        .patch("/api/ai/:shareId/conversations/:conversationId", authCheck, checkViewAccess, validateBody(aiConversationRenameSchema), renameConversation)
        .delete("/api/ai/:shareId/conversations/:conversationId", authCheck, checkViewAccess, deleteConversation);
const app = buildApp();

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
const fakeDrawing = { shareId: "board-1", owner: "user-1", elements: {}, hasEditAccess: () => true, hasViewAccess: () => true };

beforeEach(() => {
    vi.clearAllMocks();
    Drawing.findOne.mockResolvedValue(fakeDrawing);
});

describe("GET a stored thread", () => {
    it("replaces raw provider errors saved by older versions", async () => {
        AiConversation.findOwned.mockResolvedValue({
            _id: "c1",
            messages: [
                { role: "user", content: "hi" },
                { role: "assistant", content: 'AI edit failed: Groq request failed (400): {"failed_generation":"6,371 km"}', failed: true },
            ],
        });

        const res = await request(app).get("/api/ai/board-1/conversations/c1").set("Authorization", `Bearer ${token}`);

        expect(res.body.conversation.messages[1].content).not.toContain("6,371");
        expect(res.body.conversation.messages[1].content).toContain("Your board hasn't changed");
    });
});

describe("conversation threads", () => {
    const ownThread = {
        _id: "chat-1",
        shareId: "board-1",
        userId: "user-1",
        title: "Login flow",
        updatedAt: "2026-10-29T10:00:00.000Z",
        messages: [{ role: "user", content: "hi" }],
    };

    it("lists this user's threads on the board as summaries, without message bodies", async () => {
        AiConversation.listForUser.mockResolvedValue([ownThread]);

        const res = await request(buildApp()).get("/api/ai/board-1/conversations").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(AiConversation.listForUser).toHaveBeenCalledWith("board-1", "user-1");
        expect(res.body.conversations).toEqual([{ id: "chat-1", title: "Login flow", updatedAt: ownThread.updatedAt, messageCount: 1 }]);
    });

    it("starts a new thread", async () => {
        AiConversation.start.mockResolvedValue({ ...ownThread, messages: [] });

        const res = await request(buildApp()).post("/api/ai/board-1/conversations").set("Authorization", `Bearer ${token}`).send({ title: "Login flow" });

        expect(res.status).toBe(201);
        expect(AiConversation.start).toHaveBeenCalledWith("board-1", "user-1", "Login flow");
        expect(res.body.conversation.id).toBe("chat-1");
    });

    it("returns one thread with its messages", async () => {
        AiConversation.findOwned.mockResolvedValue(ownThread);

        const res = await request(buildApp()).get("/api/ai/board-1/conversations/chat-1").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(AiConversation.findOwned).toHaveBeenCalledWith({ shareId: "board-1", userId: "user-1", conversationId: "chat-1" });
        expect(res.body.conversation.messages).toEqual(ownThread.messages);
    });

    it("404s a thread that isn't this user's, for read, rename and delete alike", async () => {
        AiConversation.findOwned.mockResolvedValue(null);
        const app = buildApp();

        const read = await request(app).get("/api/ai/board-1/conversations/chat-9").set("Authorization", `Bearer ${token}`);
        const rename = await request(app).patch("/api/ai/board-1/conversations/chat-9").set("Authorization", `Bearer ${token}`).send({ title: "x" });
        const remove = await request(app).delete("/api/ai/board-1/conversations/chat-9").set("Authorization", `Bearer ${token}`);

        expect([read.status, rename.status, remove.status]).toEqual([404, 404, 404]);
        expect(AiConversation.removeById).not.toHaveBeenCalled();
    });

    it("renames and deletes an owned thread", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        AiConversation.findOwned.mockResolvedValue({ ...ownThread, save });
        const app = buildApp();

        const rename = await request(app)
            .patch("/api/ai/board-1/conversations/chat-1")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Checkout flow" });
        const remove = await request(app).delete("/api/ai/board-1/conversations/chat-1").set("Authorization", `Bearer ${token}`);

        expect(rename.status).toBe(200);
        expect(rename.body.conversation.title).toBe("Checkout flow");
        expect(save).toHaveBeenCalled();
        expect(remove.status).toBe(204);
        expect(AiConversation.removeById).toHaveBeenCalledWith("chat-1");
    });

    it("rejects an empty title", async () => {
        const res = await request(buildApp()).patch("/api/ai/board-1/conversations/chat-1").set("Authorization", `Bearer ${token}`).send({ title: "  " });

        expect(res.status).toBe(400);
    });

    it("returns 403 when the caller has no view access to the board", async () => {
        Drawing.findOne.mockResolvedValue({ ...fakeDrawing, hasViewAccess: () => false });

        const res = await request(buildApp()).get("/api/ai/board-1/conversations").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});
