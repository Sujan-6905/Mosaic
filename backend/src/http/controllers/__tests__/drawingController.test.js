import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// Both models connect to Couchbase on import, so they're mocked.
vi.mock("../../../models/drawingSchema.js", () => ({
    default: {
        createDrawing: vi.fn(),
        findOne: vi.fn(),
        findById: vi.fn(),
        writeFields: vi.fn(),
        writePreview: vi.fn(async () => ({ count: 1, elements: { a: { type: "text" } } })),
        find: vi.fn(),
        removeById: vi.fn(),
        markSwept: vi.fn(),
    },
}));
vi.mock("../../../models/userSchema.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../../../models/usernameSchema.js", () => ({ default: {} }));
vi.mock("../../../models/boardOrganizationSchema.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../../../models/boardVisitSchema.js", () => ({
    default: { find: vi.fn().mockResolvedValue({ rows: [{ userId: "collab-1", lastSeenAt: "2026-10-30T10:00:00.000Z" }] }), findOneAndUpdate: vi.fn() },
}));
vi.mock("../../../models/categorySchema.js", () => ({ default: {}, SECTIONS: ["owned", "shared"] }));
vi.mock("../../../search/indexBoard.js", () => ({ indexBoardForSearchSafely: vi.fn() }));
const ottomanQuery = vi.fn();
vi.mock("ottoman", () => ({
    getDefaultInstance: () => ({ query: ottomanQuery }),
    getCollection: vi.fn(),
    DocumentNotFoundError: class DocumentNotFoundError extends Error {},
    SearchConsistency: { LOCAL: "local" },
}));

const Drawing = (await import("../../../models/drawingSchema.js")).default;
const User = (await import("../../../models/userSchema.js")).default;
const BoardOrganization = (await import("../../../models/boardOrganizationSchema.js")).default;
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { checkDeleteAccess, checkSweptOwner } = await import("../../middlewares/checkAccess.js");
const { sweepDrawing, restoreDrawing, purgeDrawing } = await import("../sweepController.js");
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { createDrawingSchema } = await import("../../../validation/restSchemas.js");
const { createDrawing, getDrawings, getActivity, getDrawingById } = await import("../drawingController.js");
const { getCollaboratorUserIds, saveCanvasToDB, SAVE_RESULT } = await import("../../../services/boards.js");
const { DocumentNotFoundError } = await import("ottoman");
const canvasStore = (await import("../../../liveRooms/canvasStore.js")).default;
const { setIo } = await import("../../../realtime/ioRegistry.js");

// Mirrors the real route wiring (drawingRoutes.js).
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/api/drawing/create", authCheck, validateBody(createDrawingSchema), createDrawing);
    app.get("/api/drawing/get", authCheck, getDrawings);
    app.get("/api/drawing/activity", authCheck, getActivity);
    app.get("/api/drawing/get/:shareId", authCheck, getDrawingById);
    app.delete("/api/drawing/delete/:drawingId", authCheck, checkDeleteAccess, sweepDrawing);
    app.post("/api/drawing/restore/:drawingId", authCheck, checkSweptOwner, restoreDrawing);
    app.delete("/api/drawing/purge/:drawingId", authCheck, checkSweptOwner, purgeDrawing);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
const ownerToken = jwt.sign({ userId: "owner-1" }, process.env.JWT_SECRET);

// Behaves like a Drawing document's own methods (hasDeleteAccess, save) without the schema.
const buildFakeDrawing = (overrides = {}) => ({
    shareId: "share-1",
    owner: "owner-1",
    collaborators: [],
    hasDeleteAccess: (who) => (who?.userId ?? who) === "owner-1",
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    Drawing.createDrawing.mockResolvedValue({ shareId: "abc123", title: "Untitled", owner: "user-1" });
    ottomanQuery.mockResolvedValue({ rows: [] });
    BoardOrganization.find.mockResolvedValue({ rows: [] });
    setIo(null);
});

describe("GET /api/drawing/get", () => {
    it("merges this user's category/favorite onto each drawing", async () => {
        Drawing.find.mockResolvedValue({ rows: [{ shareId: "share-1", owner: "user-1", title: "Mine" }] });
        ottomanQuery.mockResolvedValue({ rows: [] }); // findDrawingsSharedWithUser
        BoardOrganization.find.mockResolvedValue({
            rows: [{ userId: "user-1", shareId: "share-1", categoryId: "cat-1", favorite: true }],
        });

        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.ownedDrawings[0]).toMatchObject({ shareId: "share-1", categoryId: "cat-1", favorite: true });
    });

    it("lists swept boards apart, so they can be put back but are never opened from the list", async () => {
        Drawing.find.mockResolvedValue({
            rows: [
                { shareId: "kept", owner: "user-1", title: "Kept" },
                { shareId: "swept", owner: "user-1", title: "Swept", deletedAt: "2026-11-17T09:00:00.000Z" },
            ],
        });
        ottomanQuery.mockResolvedValue({
            rows: [
                {
                    _id: "Drawing::x",
                    shareId: "shared-swept",
                    owner: "owner-1",
                    collaborators: [{ userId: "user-1", role: "editor" }],
                    deletedAt: "2026-11-17T09:00:00.000Z",
                },
            ],
        });

        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${token}`);

        expect(res.body.data.ownedDrawings.map((drawing) => drawing.shareId)).toEqual(["kept"]);
        expect(res.body.data.sweptDrawings.map((drawing) => drawing.shareId)).toEqual(["swept"]);
        expect(res.body.data.sharedWithDrawings).toEqual([]);
    });

    it("defaults categoryId to null and favorite to false when no organization row exists", async () => {
        Drawing.find.mockResolvedValue({ rows: [{ shareId: "share-1", owner: "user-1", title: "Mine" }] });
        ottomanQuery.mockResolvedValue({ rows: [] });
        BoardOrganization.find.mockResolvedValue({ rows: [] });

        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${token}`);

        expect(res.body.data.ownedDrawings[0]).toMatchObject({ categoryId: null, favorite: false });
    });
});

describe("the boards list is light", () => {
    it("sends each board's preview and count, never its elements", async () => {
        const preview = { count: 900, elements: { a: { type: "shape" } } };
        Drawing.find.mockResolvedValue({ rows: [{ _id: "d1", shareId: "share-1", owner: "user-1", title: "Big", preview }] });
        ottomanQuery.mockResolvedValue({ rows: [] });

        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${token}`);

        const [listed] = res.body.data.ownedDrawings;
        expect(listed).toMatchObject({ previewElements: preview.elements, elementCount: 900 });
        expect(listed).not.toHaveProperty("elements");
        expect(listed).not.toHaveProperty("preview");
        expect(Drawing.find.mock.calls[0][1].select).not.toContain("elements");
        expect(Drawing.writePreview).not.toHaveBeenCalled();
    });

    it("gives a board saved before previews existed one, once", async () => {
        Drawing.find.mockResolvedValue({ rows: [{ _id: "d1", shareId: "share-1", owner: "user-1", title: "Old" }] });
        Drawing.findById.mockResolvedValue({ elements: { a: { type: "text" } } });
        ottomanQuery.mockResolvedValue({ rows: [] });

        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${token}`);

        expect(Drawing.writePreview).toHaveBeenCalledWith("d1", { a: { type: "text" } });
        expect(res.body.data.ownedDrawings[0].elementCount).toBe(1);
    });
});

describe("credentials limited to some boards", () => {
    const owned = [
        { shareId: "picked", owner: "user-1", title: "Picked" },
        { shareId: "other", owner: "user-1", title: "Other" },
    ];
    const shared = [
        { shareId: "shared", owner: "owner-1", title: "Shared", collaborators: [{ userId: "user-1", role: "viewer", addedAt: "2026-11-09T00:00:00.000Z" }] },
    ];
    const limitedToken = jwt.sign({ userId: "user-1", boards: ["picked"] }, process.env.JWT_SECRET);

    beforeEach(() => {
        Drawing.find.mockResolvedValue({ rows: owned });
        ottomanQuery.mockImplementation(async (sql) =>
            sql.includes("collaborators") ? { rows: shared.map((drawing) => ({ ...drawing, _id: "Drawing::x" })) } : { rows: [] },
        );
    });

    it("list only the boards they were granted", async () => {
        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${limitedToken}`);

        expect(res.body.data.ownedDrawings.map((drawing) => drawing.shareId)).toEqual(["picked"]);
        expect(res.body.data.sharedWithDrawings).toEqual([]);
    });

    it("report activity only from the boards they were granted", async () => {
        User.findById.mockResolvedValue({ _id: "owner-1", username: "owner" });
        const res = await request(buildApp()).get("/api/drawing/activity?since=2026-11-01").set("Authorization", `Bearer ${limitedToken}`);

        expect(res.body.data).toEqual([]);
    });

    it("leave an unlimited sign-in seeing everything it can open", async () => {
        const res = await request(buildApp()).get("/api/drawing/get").set("Authorization", `Bearer ${token}`);

        expect(res.body.data.ownedDrawings).toHaveLength(2);
        expect(res.body.data.sharedWithDrawings.map((drawing) => drawing.shareId)).toEqual(["shared"]);
    });
});

describe("GET /api/drawing/get/:shareId", () => {
    const board = {
        shareId: "share-1",
        owner: "owner-1",
        parentShareId: "null",
        embed: { enabled: true, sites: ["https://intranet.example"] },
        getRole: (who) => ({ "owner-1": "owner", "user-1": "viewer" })[who.userId] ?? null,
    };

    it("reads a board that was never branched as having no parent", async () => {
        Drawing.findOne.mockResolvedValue(board);
        const res = await request(buildApp()).get("/api/drawing/get/share-1").set("Authorization", `Bearer ${token}`);
        expect(res.body.data.parentShareId).toBeNull();
    });

    it("shows where a board may be embedded to its owner only", async () => {
        Drawing.findOne.mockResolvedValue(board);
        const asViewer = await request(buildApp()).get("/api/drawing/get/share-1").set("Authorization", `Bearer ${token}`);
        const asOwner = await request(buildApp()).get("/api/drawing/get/share-1").set("Authorization", `Bearer ${ownerToken}`);
        expect(asViewer.body.data.embed).toBeUndefined();
        expect(asOwner.body.data.embed.sites).toEqual(["https://intranet.example"]);
    });

    it("refuses someone with no role on the board", async () => {
        Drawing.findOne.mockResolvedValue(board);
        const stranger = jwt.sign({ userId: "stranger" }, process.env.JWT_SECRET);
        const res = await request(buildApp()).get("/api/drawing/get/share-1").set("Authorization", `Bearer ${stranger}`);
        expect(res.status).toBe(403);
    });
});

describe("DELETE /api/drawing/delete/:drawingId", () => {
    it("sweeps the board away without removing it or anything kept with it", async () => {
        Drawing.findById.mockResolvedValue(buildFakeDrawing({ _id: "draw-1", shareId: "share-1" }));

        const res = await request(buildApp()).delete("/api/drawing/delete/draw-1").set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(Drawing.markSwept).toHaveBeenCalledWith("draw-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
        expect(Drawing.removeById).not.toHaveBeenCalled();
        expect(ottomanQuery).not.toHaveBeenCalledWith(expect.stringContaining("DELETE"), expect.anything());
    });

    it("closes the board's live room so autosave has nothing left to flush", async () => {
        Drawing.findById.mockResolvedValue(buildFakeDrawing({ _id: "draw-1", shareId: "share-live" }));
        const emit = vi.fn();
        const socketsLeave = vi.fn();
        setIo({ to: vi.fn(() => ({ emit })), in: vi.fn(() => ({ socketsLeave })) });
        await canvasStore.createRoom("share-live");
        await canvasStore.markDirty("share-live");

        const res = await request(buildApp()).delete("/api/drawing/delete/draw-1").set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(emit).toHaveBeenCalledWith("server:boardDeleted", { shareId: "share-live" });
        expect(socketsLeave).toHaveBeenCalledWith("share-live");
        expect(await canvasStore.roomExists("share-live")).toBe(false);
        expect(await canvasStore.popDirty()).toBeNull();
    });

    it("returns 403 for a non-owner", async () => {
        Drawing.findById.mockResolvedValue(buildFakeDrawing({ shareId: "share-1" }));

        const res = await request(buildApp()).delete("/api/drawing/delete/draw-1").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(Drawing.markSwept).not.toHaveBeenCalled();
    });
});

describe("a swept board", () => {
    const swept = (overrides = {}) => buildFakeDrawing({ _id: "draw-1", shareId: "share-1", deletedAt: "2026-11-01T00:00:00.000Z", ...overrides });

    it("is put back by its owner", async () => {
        Drawing.findById.mockResolvedValue(swept());

        const res = await request(buildApp()).post("/api/drawing/restore/draw-1").set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(Drawing.markSwept).toHaveBeenCalledWith("draw-1", null);
    });

    it("cannot be put back or purged by anyone else, who sees nothing there", async () => {
        Drawing.findById.mockResolvedValue(swept());

        const restore = await request(buildApp()).post("/api/drawing/restore/draw-1").set("Authorization", `Bearer ${token}`);
        const purge = await request(buildApp()).delete("/api/drawing/purge/draw-1").set("Authorization", `Bearer ${token}`);

        expect([restore.status, purge.status]).toEqual([404, 404]);
        expect(Drawing.markSwept).not.toHaveBeenCalled();
        expect(Drawing.removeById).not.toHaveBeenCalled();
    });

    it("must be swept before it can be purged", async () => {
        Drawing.findById.mockResolvedValue(buildFakeDrawing({ _id: "draw-1" }));

        const res = await request(buildApp()).delete("/api/drawing/purge/draw-1").set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(404);
        expect(Drawing.removeById).not.toHaveBeenCalled();
    });

    it("purges with its history, search entry, comments, conversations and merge point", async () => {
        Drawing.findById.mockResolvedValue(swept());

        const res = await request(buildApp()).delete("/api/drawing/purge/draw-1").set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(200);
        expect(Drawing.removeById).toHaveBeenCalledWith("draw-1");
        const statements = ottomanQuery.mock.calls.map(([sql]) => sql).join("\n");
        ["comments", "operationLogs", "snapshots", "searchIndexes", "aiConversations", "mergeBases"].forEach((collection) =>
            expect(statements).toContain(`\`${collection}\``),
        );
        expect(ottomanQuery).toHaveBeenCalledWith(expect.stringContaining("mergeBases"), { parameters: { key: "MergeBase::share-1" } });
    });

    it("stays listed when cleaning up after it fails, so the purge can be tried again", async () => {
        Drawing.findById.mockResolvedValue(swept());
        ottomanQuery.mockRejectedValueOnce(new Error("query timeout"));

        const res = await request(buildApp()).delete("/api/drawing/purge/draw-1").set("Authorization", `Bearer ${ownerToken}`);

        expect(res.status).toBe(500);
        expect(Drawing.removeById).not.toHaveBeenCalled();
    });
});

describe("POST /api/drawing/create", () => {
    it("owns the new drawing by the JWT's userId, ignoring a spoofed body.userId", async () => {
        const res = await request(buildApp())
            .post("/api/drawing/create")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Untitled", userId: "someone-elses-id" });

        expect(res.status).toBe(200);
        expect(Drawing.createDrawing).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "user-1" }));
    });

    it("rejects an unauthenticated request before touching the DB", async () => {
        const res = await request(buildApp()).post("/api/drawing/create").send({ title: "Untitled" });

        expect(res.status).toBe(401);
        expect(Drawing.createDrawing).not.toHaveBeenCalled();
    });

    it("rejects a missing title", async () => {
        const res = await request(buildApp()).post("/api/drawing/create").set("Authorization", `Bearer ${token}`).send({});

        expect(res.status).toBe(400);
        expect(Drawing.createDrawing).not.toHaveBeenCalled();
    });
});

// The real in-memory canvasStore, since checking stored participants is the point.
describe("getCollaboratorUserIds", () => {
    it("returns the owner and every collaborator's userId", async () => {
        Drawing.findOne.mockResolvedValue(
            buildFakeDrawing({
                collaborators: [
                    { userId: "user-2", role: "viewer" },
                    { userId: "user-3", role: "editor" },
                ],
            }),
        );

        const ids = await getCollaboratorUserIds("share-1");
        expect(ids).toEqual(new Set(["owner-1", "user-2", "user-3"]));
    });

    it("returns an empty set for a shareId with no matching drawing", async () => {
        Drawing.findOne.mockRejectedValue(Object.assign(new Error("not found"), { name: "DocumentNotFoundError" }));

        const ids = await getCollaboratorUserIds("missing-share");
        expect(ids).toEqual(new Set());
    });
});

describe("saveCanvasToDB", () => {
    const save = () => saveCanvasToDB({ canvasShareId: "share-1", canvasElements: {}, canvasBackground: null });

    it("writes only the canvas fields, so a save can't undo a role change made at the same moment", async () => {
        Drawing.findOne.mockResolvedValue({ _id: "drawing-1" });
        Drawing.writeFields.mockResolvedValue({});

        expect(await save()).toBe(SAVE_RESULT.SAVED);
        expect(Drawing.writeFields).toHaveBeenLastCalledWith("drawing-1", { elements: {}, background: null });
    });

    it("reports a board with no drawing as gone rather than failed", async () => {
        Drawing.findOne.mockRejectedValue(new DocumentNotFoundError());

        expect(await save()).toBe(SAVE_RESULT.BOARD_GONE);
    });

    it("reports a board deleted between the lookup and the write as gone", async () => {
        Drawing.findOne.mockResolvedValue({ _id: "drawing-1" });
        Drawing.writeFields.mockRejectedValue(new DocumentNotFoundError());

        expect(await save()).toBe(SAVE_RESULT.BOARD_GONE);
    });

    it("reports any other error as a failed save", async () => {
        Drawing.findOne.mockResolvedValue({ _id: "drawing-1" });
        Drawing.writeFields.mockRejectedValue(new Error("timeout"));

        expect(await save()).toBe(SAVE_RESULT.FAILED);
    });
});

describe("GET /api/drawing/activity", () => {
    const since = "2026-10-01T00:00:00.000Z";

    it("rejects a since that is not a date", async () => {
        const res = await request(buildApp()).get("/api/drawing/activity?since=soon").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("merges recent comments by others with boards newly shared, newest first", async () => {
        Drawing.find.mockResolvedValue({ rows: [buildFakeDrawing({ shareId: "mine", title: "Onboarding flow", owner: "user-1" })] });
        ottomanQuery
            .mockResolvedValueOnce({
                rows: [
                    {
                        _id: "Drawing::d2",
                        shareId: "theirs",
                        title: "Hiring loop",
                        owner: "owner-2",
                        collaborators: [{ userId: "user-1", role: "editor", addedAt: "2026-10-20T00:00:00.000Z" }],
                    },
                    {
                        _id: "Drawing::d3",
                        shareId: "old",
                        title: "Old board",
                        owner: "owner-2",
                        collaborators: [{ userId: "user-1", role: "viewer" }],
                    },
                ],
            })
            .mockResolvedValueOnce({ rows: [{ authorName: "akash", shareId: "mine", createdAt: "2026-10-25T00:00:00.000Z" }] });
        User.findById.mockResolvedValue({ _id: "owner-2", username: "riya" });

        const res = await request(buildApp()).get(`/api/drawing/activity?since=${since}`).set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([
            { kind: "comment", actor: "akash", shareId: "mine", title: "Onboarding flow", at: "2026-10-25T00:00:00.000Z" },
            { kind: "shared", actor: "riya", shareId: "theirs", title: "Hiring loop", at: "2026-10-20T00:00:00.000Z" },
        ]);
        expect(ottomanQuery.mock.calls[1][1].parameters).toMatchObject({ userId: "user-1", since });
    });
});

describe("recordLastSeen", () => {
    it("writes its own row and leaves the drawing document alone, so leaving can't conflict with a save", async () => {
        const { recordLastSeen } = await import("../../../services/boards.js");
        const BoardVisit = (await import("../../../models/boardVisitSchema.js")).default;
        Drawing.writeFields.mockClear();

        await recordLastSeen("share-1", "user-2");

        expect(BoardVisit.findOneAndUpdate).toHaveBeenCalledWith(
            { shareId: "share-1", userId: "user-2" },
            expect.objectContaining({ lastSeenAt: expect.any(String) }),
            { upsert: true },
        );
        expect(Drawing.writeFields).not.toHaveBeenCalled();
    });

    it("never throws, since it runs while someone is leaving a room", async () => {
        const { recordLastSeen } = await import("../../../services/boards.js");
        const BoardVisit = (await import("../../../models/boardVisitSchema.js")).default;
        BoardVisit.findOneAndUpdate.mockRejectedValueOnce(new Error("store down"));

        await expect(recordLastSeen("share-1", "user-2")).resolves.toBeUndefined();
    });
});
