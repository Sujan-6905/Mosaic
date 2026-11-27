import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../../../models/pieceSetSchema.js", () => ({
    default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), removeById: vi.fn(), writeFields: vi.fn(), appendPiece: vi.fn(), countInstall: vi.fn() },
}));
vi.mock("../../../models/userSchema.js", () => ({ default: { findById: vi.fn() } }));

const PieceSet = (await import("../../../models/pieceSetSchema.js")).default;
const User = (await import("../../../models/userSchema.js")).default;
const { default: pieceRoutes } = await import("../../routes/pieceRoutes.js");

const buildApp = () =>
    express()
        .use(express.json({ limit: "2mb" }))
        .use("/api/pieces", pieceRoutes);
const owner = `Bearer ${jwt.sign({ userId: "owner" }, process.env.JWT_SECRET)}`;
const stranger = `Bearer ${jwt.sign({ userId: "stranger" }, process.env.JWT_SECRET)}`;

const box = {
    type: "shape",
    shapeType: "Rectangle",
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 60,
    color: "#000000",
    size: 2,
    opacity: 100,
    zIndex: 1,
    rotation: 0,
};
const fakeSet = (overrides = {}) => ({
    _id: "set-1",
    ownerId: "owner",
    title: "Flow",
    description: "",
    pieces: [{ id: "p1", name: "Box", elements: { a: box } }],
    published: false,
    installs: 0,
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    PieceSet.find.mockResolvedValue({ rows: [] });
});

describe("piece sets", () => {
    it("lists only the caller's own sets", async () => {
        PieceSet.find.mockResolvedValue({ rows: [fakeSet()] });
        const res = await request(buildApp()).get("/api/pieces").set("Authorization", owner);
        expect(res.status).toBe(200);
        expect(PieceSet.find).toHaveBeenCalledWith({ ownerId: "owner" }, expect.anything());
        expect(res.body.sets[0].title).toBe("Flow");
    });

    it("creates a set with its pieces, giving each piece an id", async () => {
        PieceSet.create.mockImplementation(async (doc) => ({ _id: "new", ...doc }));
        const res = await request(buildApp())
            .post("/api/pieces")
            .set("Authorization", owner)
            .send({ title: "Mine", pieces: [{ name: "Box", elements: { a: box } }] });
        expect(res.status).toBe(201);
        expect(res.body.set.pieces[0].id).toEqual(expect.any(String));
    });

    it("refuses a piece whose elements a board would refuse", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet());
        const res = await request(buildApp())
            .post("/api/pieces/set-1/pieces")
            .set("Authorization", owner)
            .send({ name: "Bad", elements: { a: { type: "shape", startX: "nope" } } });
        expect(res.status).toBe(400);
        expect(PieceSet.appendPiece).not.toHaveBeenCalled();
    });

    it("refuses an embed pointing at a script address", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet());
        const embed = { type: "embed", startX: 0, startY: 0, endX: 10, endY: 10, url: "javascript:alert(1)", zIndex: 1, rotation: 0 };
        const res = await request(buildApp())
            .post("/api/pieces/set-1/pieces")
            .set("Authorization", owner)
            .send({ name: "Bad", elements: { a: embed } });
        expect(res.status).toBe(400);
    });

    it("adds a valid piece with a single atomic append", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet());
        const res = await request(buildApp())
            .post("/api/pieces/set-1/pieces")
            .set("Authorization", owner)
            .send({ name: "Box", elements: { a: box } });
        expect(res.status).toBe(201);
        expect(PieceSet.appendPiece).toHaveBeenCalledWith("set-1", expect.objectContaining({ name: "Box" }));
    });

    it("hides someone else's set from every change", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet());
        const responses = await Promise.all([
            request(buildApp()).patch("/api/pieces/set-1").set("Authorization", stranger).send({ published: true }),
            request(buildApp()).delete("/api/pieces/set-1").set("Authorization", stranger),
            request(buildApp()).delete("/api/pieces/set-1/pieces/p1").set("Authorization", stranger),
        ]);
        responses.forEach((res) => expect(res.status).toBe(404));
        expect(PieceSet.writeFields).not.toHaveBeenCalled();
        expect(PieceSet.removeById).not.toHaveBeenCalled();
    });

    it("only opens a shared set once it's published", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet());
        expect((await request(buildApp()).get("/api/pieces/shared/set-1").set("Authorization", stranger)).status).toBe(404);
        PieceSet.findById.mockResolvedValue(fakeSet({ published: true }));
        User.findById.mockResolvedValue({ username: "ada" });
        const res = await request(buildApp()).get("/api/pieces/shared/set-1").set("Authorization", stranger);
        expect(res.status).toBe(200);
        expect(res.body.set.ownerName).toBe("ada");
    });

    it("installs a published set as the installer's own copy and counts it", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet({ published: true }));
        PieceSet.create.mockImplementation(async (doc) => ({ _id: "copy", ...doc }));
        const res = await request(buildApp()).post("/api/pieces/shared/set-1/install").set("Authorization", stranger);
        expect(res.status).toBe(201);
        expect(PieceSet.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "stranger", installedFrom: "set-1" }));
        expect(PieceSet.countInstall).toHaveBeenCalledWith("set-1");
    });

    it("needs a signed-in person for everything", async () => {
        expect((await request(buildApp()).get("/api/pieces")).status).toBe(401);
    });
});

describe("the pieces gallery", () => {
    it("lists listed sets without signing in, with who made them and a few pieces to preview", async () => {
        PieceSet.find.mockResolvedValue({ rows: [fakeSet({ listed: true, published: true, tags: ["cloud"], license: "CC0-1.0", installs: 4 })] });
        User.findById.mockResolvedValue({ username: "sujan" });
        const res = await request(buildApp()).get("/api/pieces/gallery");
        expect(res.status).toBe(200);
        expect(PieceSet.find).toHaveBeenCalledWith({ listed: true }, expect.objectContaining({ sort: { installs: "DESC" } }));
        expect(res.body.sets[0]).toMatchObject({ title: "Flow", ownerName: "sujan", pieceCount: 1, license: "CC0-1.0", tags: ["cloud"] });
        expect(res.body.sets[0].preview[0].elements.a).toBeDefined();
        expect(res.body.tags).toEqual(["cloud"]);
    });

    it("filters by tag and words", async () => {
        PieceSet.find.mockResolvedValue({
            rows: [fakeSet({ listed: true, tags: ["uml"] }), fakeSet({ _id: "set-2", title: "Cloud parts", listed: true, tags: ["cloud"] })],
        });
        const res = await request(buildApp()).get("/api/pieces/gallery?tag=cloud&q=parts");
        expect(res.body.sets.map((set) => set._id)).toEqual(["set-2"]);
    });

    it("needs a licence to list a set, and listing shares it", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet());
        const refused = await request(buildApp()).patch("/api/pieces/set-1").set("Authorization", owner).send({ listed: true });
        expect(refused.status).toBe(400);
        const res = await request(buildApp())
            .patch("/api/pieces/set-1")
            .set("Authorization", owner)
            .send({ listed: true, license: "MIT", tags: ["Cloud"] });
        expect(res.status).toBe(200);
        expect(PieceSet.writeFields).toHaveBeenCalledWith("set-1", { listed: true, license: "MIT", tags: ["cloud"], published: true });
    });

    it("lists a set whose empty fields were stored as the text null, and reports them as null", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet({ installedFrom: "null", license: "null" }));
        const res = await request(buildApp()).patch("/api/pieces/set-1").set("Authorization", owner).send({ listed: true, license: "MIT" });
        expect(res.status).toBe(200);
        expect(res.body.set.installedFrom).toBeNull();
        expect(res.body.set.license).toBe("MIT");
    });

    it("won't list a set someone installed from another person", async () => {
        PieceSet.findById.mockResolvedValue(fakeSet({ installedFrom: "theirs" }));
        const res = await request(buildApp()).patch("/api/pieces/set-1").set("Authorization", owner).send({ listed: true, license: "MIT" });
        expect(res.status).toBe(409);
    });
});
