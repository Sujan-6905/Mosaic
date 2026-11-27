import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../../models/drawingSchema.js", () => ({ default: { findOne: vi.fn(), findById: vi.fn(), writeFields: vi.fn() } }));
vi.mock("../../../models/userSchema.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../../../models/boardVisitSchema.js", () => ({
    default: { find: vi.fn().mockResolvedValue({ rows: [{ userId: "collab-1", lastSeenAt: "2026-10-30T10:00:00.000Z" }] }) },
}));
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: vi.fn() }) }));
vi.mock("../authController.js", () => ({ findUserByUsername: vi.fn() }));
vi.mock("../../../services/notifications.js", () => ({ notify: vi.fn().mockResolvedValue(null) }));
vi.mock("../../../services/boards.js", () => ({ getUsername: vi.fn(async () => "owner-name") }));

const Drawing = (await import("../../../models/drawingSchema.js")).default;
const User = (await import("../../../models/userSchema.js")).default;
const { findUserByUsername } = await import("../authController.js");
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { checkDeleteAccess } = await import("../../middlewares/checkAccess.js");
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { addCollaboratorSchema, removeCollaboratorSchema, updateCollaboratorRoleSchema } = await import("../../../validation/restSchemas.js");
const { addCollaborator, removeCollaborator, updateCollaboratorRole, getCollaborator } = await import("../collaboratorController.js");
const canvasStore = (await import("../../../liveRooms/canvasStore.js")).default;
const { setIo } = await import("../../../realtime/ioRegistry.js");

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.get("/api/drawing/collaborators/:shareId", authCheck, getCollaborator);
    app.put("/api/drawing/collaborators/:shareId", authCheck, checkDeleteAccess, validateBody(addCollaboratorSchema), addCollaborator);
    app.delete("/api/drawing/collaborators/:shareId", authCheck, checkDeleteAccess, validateBody(removeCollaboratorSchema), removeCollaborator);
    app.patch("/api/drawing/collaborators/:shareId/role", authCheck, checkDeleteAccess, validateBody(updateCollaboratorRoleSchema), updateCollaboratorRole);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
const ownerToken = jwt.sign({ userId: "owner-1" }, process.env.JWT_SECRET);

const buildFakeDrawing = (overrides = {}) => ({
    shareId: "share-1",
    owner: "owner-1",
    collaborators: [],
    hasDeleteAccess: (who) => (who?.userId ?? who) === "owner-1",
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    setIo(null);
});

describe("GET /api/drawing/collaborators/:shareId", () => {
    const linkShared = () => ({
        ...buildFakeDrawing({ collaborators: [{ userId: "collab-1", role: "editor" }], linkAccess: "viewer" }),
        hasViewAccess: () => true,
    });

    beforeEach(() => User.findById.mockImplementation(async (id) => ({ _id: id, username: `name-${id}` })));

    it("tells the people on the board when each of them was last here", async () => {
        Drawing.findOne.mockResolvedValue(linkShared());
        const res = await request(buildApp()).get("/api/drawing/collaborators/share-1").set("Authorization", `Bearer ${ownerToken}`);
        expect(res.body.collaborators[0].lastSeenAt).toBe("2026-10-30T10:00:00.000Z");
    });

    it("keeps that from someone who only holds the public link", async () => {
        Drawing.findOne.mockResolvedValue(linkShared());
        const res = await request(buildApp()).get("/api/drawing/collaborators/share-1").set("Authorization", `Bearer ${token}`);
        expect(res.body.collaborators[0].lastSeenAt).toBeNull();
    });
});

describe("live access after a collaborator change", () => {
    const fakeSocket = (id, principal) => ({ id, data: { principal }, emit: vi.fn(), leave: vi.fn() });
    const buildIo = (boardSockets) => {
        const presence = vi.fn();
        const io = {
            in: vi.fn((room) => ({ fetchSockets: async () => (room === "share-1" ? boardSockets : []) })),
            to: vi.fn(() => ({ emit: presence })),
        };
        return { io, presence };
    };

    it("lowers a demoted collaborator's stored role, so their open connection can no longer edit", async () => {
        const drawing = buildFakeDrawing({ collaborators: [{ userId: "user-2", role: "editor", addedAt: "2026-11-01T00:00:00.000Z" }] });
        Drawing.findOne.mockResolvedValue(drawing);
        findUserByUsername.mockResolvedValue({ _id: "user-2", username: "bob" });
        const bob = fakeSocket("socket-bob", { userId: "user-2" });
        const { io, presence } = buildIo([bob]);
        setIo(io);
        await canvasStore.createRoom("share-1");
        await canvasStore.addParticipant("share-1", "socket-bob", { userId: "user-2", role: "editor", name: "bob", color: "#111" });

        const res = await request(buildApp())
            .patch("/api/drawing/collaborators/share-1/role")
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({ username: "bob", role: "viewer" });

        expect(res.status).toBe(200);
        expect(drawing.collaborators).toEqual([{ userId: "user-2", role: "viewer", addedAt: "2026-11-01T00:00:00.000Z" }]);
        expect((await canvasStore.getParticipant("share-1", "socket-bob")).role).toBe("viewer");
        expect(bob.emit).toHaveBeenCalledWith("server:roleChanged", { shareId: "share-1" });
        expect(presence).toHaveBeenCalledWith("server:presenceUpdate", [expect.objectContaining({ socketId: "socket-bob", role: "viewer" })]);

        await canvasStore.deleteRoom("share-1");
    });

    it("does nothing on a brand-new invite, since nobody connected has a role to change", async () => {
        Drawing.findOne.mockResolvedValue(buildFakeDrawing());
        findUserByUsername.mockResolvedValue({ _id: "user-3", username: "carol" });
        const { io } = buildIo([]);
        setIo(io);

        const res = await request(buildApp())
            .put("/api/drawing/collaborators/share-1")
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({ username: "carol", role: "viewer" });

        expect(res.status).toBe(200);
        expect(io.in).not.toHaveBeenCalled();
        const { notify } = await import("../../../services/notifications.js");
        expect(notify).toHaveBeenCalledWith(
            "user-3",
            expect.objectContaining({ kind: "shared", shareId: "share-1", actorName: "owner-name", preview: "viewer" }),
        );
    });

    it("PATCH /collaborators/:shareId/role rejects updating someone who isn't already a collaborator", async () => {
        const drawing = buildFakeDrawing();
        Drawing.findOne.mockResolvedValue(drawing);
        findUserByUsername.mockResolvedValue({ _id: "user-4", username: "dave" });

        const res = await request(buildApp())
            .patch("/api/drawing/collaborators/share-1/role")
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({ username: "dave", role: "editor" });

        expect(res.status).toBe(404);
        expect(Drawing.writeFields).not.toHaveBeenCalled();
    });

    it("takes a removed collaborator out of the live room, so they stop receiving and sending edits", async () => {
        const drawing = buildFakeDrawing({ collaborators: [{ userId: "user-5", role: "editor" }] });
        Drawing.findOne.mockResolvedValue(drawing);
        Drawing.writeFields.mockResolvedValue({});
        findUserByUsername.mockResolvedValue({ _id: "user-5", username: "erin" });
        const erin = fakeSocket("socket-erin", { userId: "user-5" });
        const owner = fakeSocket("socket-owner", { userId: "owner-1" });
        const { io } = buildIo([erin, owner]);
        setIo(io);
        await canvasStore.createRoom("share-1");
        await canvasStore.addParticipant("share-1", "socket-erin", { userId: "user-5", role: "editor", name: "erin", color: "#222" });
        await canvasStore.addParticipant("share-1", "socket-owner", { userId: "owner-1", role: "owner", name: "owner", color: "#333" });

        const res = await request(buildApp())
            .delete("/api/drawing/collaborators/share-1")
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({ username: "erin" });

        expect(res.status).toBe(200);
        expect(Drawing.writeFields).toHaveBeenLastCalledWith(drawing._id, { collaborators: [] });
        expect(erin.leave).toHaveBeenCalledWith("share-1");
        expect(erin.emit).toHaveBeenCalledWith("server:accessRevoked", { shareId: "share-1" });
        expect(await canvasStore.getParticipant("share-1", "socket-erin")).toBeNull();
        expect(owner.leave).not.toHaveBeenCalled();

        await canvasStore.deleteRoom("share-1");
    });
});
