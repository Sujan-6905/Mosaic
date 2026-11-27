import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const ottomanQuery = vi.fn();
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: ottomanQuery }) }));
vi.mock("../drawingController.js", () => ({ listAccessibleDrawings: vi.fn() }));

const { listAccessibleDrawings } = await import("../drawingController.js");
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const { getAccessibleShareIds, searchBoardsHandler } = await import("../searchController.js");

const buildApp = () => {
    const app = express();
    app.get("/api/search", authCheck, searchBoardsHandler);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);

const reachable = ({ owned = [], shared = [] }) =>
    listAccessibleDrawings.mockResolvedValue({ owned: owned.map((shareId) => ({ shareId })), shared: shared.map((shareId) => ({ shareId })) });

beforeEach(() => {
    vi.clearAllMocks();
    reachable({});
    ottomanQuery.mockResolvedValue({ rows: [] });
});

describe("getAccessibleShareIds", () => {
    it("combines owned and shared board shareIds", async () => {
        reachable({ owned: ["owned-1", "owned-2"], shared: ["shared-1"] });

        const ids = await getAccessibleShareIds({ userId: "user-1" });

        expect(ids.sort()).toEqual(["owned-1", "owned-2", "shared-1"]);
    });
});

describe("GET /api/search", () => {
    it("requires a query", async () => {
        const res = await request(buildApp()).get("/api/search").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 401 with no auth token", async () => {
        const res = await request(buildApp()).get("/api/search?q=auth");
        expect(res.status).toBe(401);
    });

    it("scopes the underlying index lookup to only the boards the user can access", async () => {
        reachable({ owned: ["owned-1"], shared: ["shared-1"] });

        await request(buildApp()).get("/api/search?q=auth").set("Authorization", `Bearer ${token}`);

        expect(ottomanQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE shareId IN"), { parameters: { shareIds: ["owned-1", "shared-1"] } });
    });

    it("skips the index query entirely when the user has no accessible boards", async () => {
        const res = await request(buildApp()).get("/api/search?q=auth").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.results).toEqual([]);
        expect(ottomanQuery).not.toHaveBeenCalled();
    });

    it("ranks and returns matching boards from the accessible set", async () => {
        reachable({ owned: ["board-1"] });
        ottomanQuery.mockResolvedValue({
            rows: [{ shareId: "board-1", title: "Auth Flow", chunks: [{ text: "user login flow with OAuth", embedding: Array(128).fill(0.01) }] }],
        });

        const res = await request(buildApp()).get("/api/search?q=auth").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.results[0].shareId).toBe("board-1");
    });
});
