import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const ottomanQuery = vi.fn();
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: ottomanQuery }), SearchConsistency: { GLOBAL: 2 } }));
vi.mock("../../../models/categorySchema.js", () => ({
    default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), removeById: vi.fn() },
    SECTIONS: ["owned", "shared"],
}));
vi.mock("../../../models/boardOrganizationSchema.js", () => ({
    default: { find: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));
vi.mock("../../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn() },
}));

const Category = (await import("../../../models/categorySchema.js")).default;
const BoardOrganization = (await import("../../../models/boardOrganizationSchema.js")).default;
const Drawing = (await import("../../../models/drawingSchema.js")).default;
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { createCategorySchema, updateCategorySchema, setBoardOrganizationSchema } = await import("../../../validation/restSchemas.js");
const { getCategoriesHandler, createCategoryHandler, updateCategoryHandler, deleteCategoryHandler, getBoardOrganizationHandler, setBoardOrganizationHandler } =
    await import("../organizationController.js");

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.get("/api/organization/categories", authCheck, getCategoriesHandler);
    app.post("/api/organization/categories", authCheck, validateBody(createCategorySchema), createCategoryHandler);
    app.patch("/api/organization/categories/:categoryId", authCheck, validateBody(updateCategorySchema), updateCategoryHandler);
    app.delete("/api/organization/categories/:categoryId", authCheck, deleteCategoryHandler);
    app.get("/api/organization/boards/:shareId", authCheck, getBoardOrganizationHandler);
    app.put("/api/organization/boards/:shareId", authCheck, validateBody(setBoardOrganizationSchema), setBoardOrganizationHandler);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);

const buildFakeCategory = (overrides = {}) => ({
    _id: "cat-1",
    userId: "user-1",
    section: "owned",
    name: "Work",
    order: 0,
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    ottomanQuery.mockResolvedValue({ rows: [] });
});

describe("GET /api/organization/categories", () => {
    it("returns this user's categories for the given section, sorted", async () => {
        Category.find.mockResolvedValue({ rows: [buildFakeCategory()] });

        const res = await request(buildApp()).get("/api/organization/categories?section=owned").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.categories).toHaveLength(1);
        expect(Category.find).toHaveBeenCalledWith({ userId: "user-1", section: "owned" }, { sort: { order: "ASC" }, consistency: 2 });
    });

    it("rejects an invalid section", async () => {
        const res = await request(buildApp()).get("/api/organization/categories?section=bogus").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(Category.find).not.toHaveBeenCalled();
    });
});

describe("POST /api/organization/categories", () => {
    it("creates a category with the next order after existing ones", async () => {
        Category.find.mockResolvedValue({ rows: [buildFakeCategory({ order: 0 }), buildFakeCategory({ order: 1 })] });
        Category.create.mockResolvedValue(buildFakeCategory({ order: 2, name: "Archive" }));

        const res = await request(buildApp())
            .post("/api/organization/categories")
            .set("Authorization", `Bearer ${token}`)
            .send({ section: "owned", name: "Archive" });

        expect(res.status).toBe(201);
        expect(Category.create).toHaveBeenCalledWith({ userId: "user-1", section: "owned", name: "Archive", order: 2 });
    });

    it("rejects an empty name", async () => {
        const res = await request(buildApp()).post("/api/organization/categories").set("Authorization", `Bearer ${token}`).send({ section: "owned", name: "" });

        expect(res.status).toBe(400);
        expect(Category.create).not.toHaveBeenCalled();
    });
});

describe("PATCH /api/organization/categories/:categoryId", () => {
    it("renames a category the user owns", async () => {
        Category.findById.mockResolvedValue(buildFakeCategory());

        const res = await request(buildApp()).patch("/api/organization/categories/cat-1").set("Authorization", `Bearer ${token}`).send({ name: "Renamed" });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe("Renamed");
    });

    it("returns 403 when the category belongs to someone else", async () => {
        Category.findById.mockResolvedValue(buildFakeCategory({ userId: "someone-else" }));

        const res = await request(buildApp()).patch("/api/organization/categories/cat-1").set("Authorization", `Bearer ${token}`).send({ name: "Renamed" });

        expect(res.status).toBe(403);
    });

    it("returns 404 for a category that doesn't exist", async () => {
        Category.findById.mockRejectedValue(Object.assign(new Error("not found"), { name: "DocumentNotFoundError" }));

        const res = await request(buildApp()).patch("/api/organization/categories/ghost").set("Authorization", `Bearer ${token}`).send({ name: "Renamed" });

        expect(res.status).toBe(404);
    });
});

describe("DELETE /api/organization/categories/:categoryId", () => {
    it("clears categoryId off every board organization row that referenced it, then deletes the category", async () => {
        Category.findById.mockResolvedValue(buildFakeCategory());

        const res = await request(buildApp()).delete("/api/organization/categories/cat-1").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(ottomanQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE"), { parameters: { userId: "user-1", categoryId: "cat-1" } });
        expect(Category.removeById).toHaveBeenCalledWith("cat-1");
    });

    it("does not delete a category owned by someone else", async () => {
        Category.findById.mockResolvedValue(buildFakeCategory({ userId: "someone-else" }));

        const res = await request(buildApp()).delete("/api/organization/categories/cat-1").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(Category.removeById).not.toHaveBeenCalled();
    });
});

describe("PUT /api/organization/boards/:shareId", () => {
    const fakeOwnedDrawing = { shareId: "board-1", owner: "user-1", hasViewAccess: () => true };
    const fakeSharedDrawing = { shareId: "board-1", owner: "someone-else", hasViewAccess: () => true };

    it("stars a board without needing a category", async () => {
        Drawing.findOne.mockResolvedValue(fakeOwnedDrawing);
        BoardOrganization.findOne.mockResolvedValue(null);
        BoardOrganization.create.mockResolvedValue({ categoryId: null, favorite: true });

        const res = await request(buildApp()).put("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`).send({ favorite: true });

        expect(res.status).toBe(200);
        expect(res.body.data.favorite).toBe(true);
        expect(BoardOrganization.create).toHaveBeenCalledWith({ userId: "user-1", shareId: "board-1", categoryId: null, favorite: true });
    });

    it("assigns an owned-section category to a board the user owns", async () => {
        Drawing.findOne.mockResolvedValue(fakeOwnedDrawing);
        Category.findById.mockResolvedValue(buildFakeCategory({ section: "owned" }));
        BoardOrganization.findOne.mockResolvedValue(null);
        BoardOrganization.create.mockResolvedValue({ categoryId: "cat-1", favorite: false });

        const res = await request(buildApp()).put("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`).send({ categoryId: "cat-1" });

        expect(res.status).toBe(200);
    });

    it("rejects an owned-section category on a board the user only has shared access to", async () => {
        Drawing.findOne.mockResolvedValue(fakeSharedDrawing);
        Category.findById.mockResolvedValue(buildFakeCategory({ section: "owned" }));

        const res = await request(buildApp()).put("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`).send({ categoryId: "cat-1" });

        expect(res.status).toBe(400);
        expect(BoardOrganization.create).not.toHaveBeenCalled();
    });

    it("rejects a category that belongs to a different user", async () => {
        Drawing.findOne.mockResolvedValue(fakeOwnedDrawing);
        Category.findById.mockResolvedValue(buildFakeCategory({ userId: "someone-else" }));

        const res = await request(buildApp()).put("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`).send({ categoryId: "cat-1" });

        expect(res.status).toBe(400);
    });

    it("returns 403 when the caller has no access to the board at all", async () => {
        Drawing.findOne.mockResolvedValue({ ...fakeOwnedDrawing, hasViewAccess: () => false });

        const res = await request(buildApp()).put("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`).send({ favorite: true });

        expect(res.status).toBe(403);
    });

    it("updates an existing organization row in place instead of creating a duplicate", async () => {
        Drawing.findOne.mockResolvedValue(fakeOwnedDrawing);
        const existing = { categoryId: null, favorite: false, save: vi.fn().mockResolvedValue(true) };
        BoardOrganization.findOne.mockResolvedValue(existing);

        const res = await request(buildApp()).put("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`).send({ favorite: true });

        expect(res.status).toBe(200);
        expect(existing.save).toHaveBeenCalled();
        expect(BoardOrganization.create).not.toHaveBeenCalled();
    });
});

describe("GET /api/organization/boards/:shareId", () => {
    it("returns this user's organization row for the board", async () => {
        BoardOrganization.findOne.mockResolvedValue({ categoryId: "cat-1", favorite: true });

        const res = await request(buildApp()).get("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ categoryId: "cat-1", favorite: true });
    });

    it("defaults to uncategorized/not-favorited when no row exists yet", async () => {
        BoardOrganization.findOne.mockResolvedValue(null);

        const res = await request(buildApp()).get("/api/organization/boards/board-1").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ categoryId: null, favorite: false });
    });
});
