import { describe, it, expect, vi } from "vitest";

vi.mock("../../models/userActivitySchema.js", () => ({ default: {} }));
vi.mock("ottoman", () => ({ getDefaultInstance: vi.fn() }));

const { getDefaultInstance } = await import("ottoman");
const { buildWall, readActivityYears, recordActivity, tallyOps, WALL_DAYS } = await import("../userActivity.js");

const at = (iso) => new Date(iso).getTime();

describe("tallyOps", () => {
    it("counts a person's pieces per day and the boards they were on", () => {
        const { tallies } = tallyOps([
            { authorId: "u1", shareId: "a", ts: at("2026-11-17T09:00:00Z") },
            { authorId: "u1", shareId: "b", ts: at("2026-11-17T23:00:00Z") },
            { authorId: "u1", shareId: "a", ts: at("2026-11-18T01:00:00Z") },
            { authorId: "u2", shareId: "a", ts: at("2026-11-17T09:00:00Z") },
        ]);
        const byKey = Object.fromEntries(tallies.map((t) => [`${t.userId} ${t.day}`, [t.pieces, [...t.boards]]]));
        expect(byKey).toEqual({ "u1 2026-11-17": [2, ["a", "b"]], "u1 2026-11-18": [1, ["a"]], "u2 2026-11-17": [1, ["a"]] });
    });

    it("leaves an agent's work off the person's tally, but notes the agent was there", () => {
        const { tallies, agentHelped } = tallyOps([{ authorId: "u1", agentId: "claude", shareId: "a", ts: at("2026-11-17T09:00:00Z") }]);
        expect(tallies).toEqual([]);
        expect(agentHelped).toEqual(["u1"]);
    });
});

describe("recordActivity", () => {
    it("still counts a flush on a board the day already lists", async () => {
        const paths = [];
        const mutateIn = vi.fn(async (_key, specs) => {
            const board = specs.find((spec) => String(spec._path).endsWith(".boards"));
            if (board) {
                const error = new Error("path exists");
                error.name = "PathExistsError";
                throw error;
            }
            paths.push(...specs.map((spec) => spec._path));
        });
        getDefaultInstance.mockReturnValue({ getCollection: () => ({ mutateIn }) });

        await recordActivity([{ authorId: "u1", shareId: "a", ts: at("2026-11-17T09:00:00Z") }]);

        expect(paths).toContain("days.`2026-11-17`.pieces");
    });
});

describe("readActivityYears", () => {
    it("reads each year by key, and a year with no work as nothing", async () => {
        const get = vi.fn(async (key) => {
            if (key.endsWith(":2026")) return { content: { userId: "u1", days: { "2026-11-17": { pieces: 4 } } } };
            const error = new Error("missing");
            error.name = "DocumentNotFoundError";
            throw error;
        });
        getDefaultInstance.mockReturnValue({ getCollection: () => ({ get }) });

        const docs = await readActivityYears("u1", [2025, 2026]);

        expect(docs[0]).toBeNull();
        expect(docs[1].days["2026-11-17"].pieces).toBe(4);
        expect(get).toHaveBeenCalledWith("UserActivity::u1:2026");
    });
});

describe("buildWall", () => {
    const now = new Date("2026-11-18T12:00:00Z");

    it("lays the last 53 weeks oldest first, ending today, across the year boundary", () => {
        const wall = buildWall([{ days: { "2025-11-20": { pieces: 3, boards: ["a"] } } }, { days: { "2026-11-18": { pieces: 5, boards: ["a", "b"] } } }], {
            now,
        });
        expect(wall.days).toHaveLength(WALL_DAYS);
        expect(wall.days.at(-1)).toEqual({ day: "2026-11-18", pieces: 5, boards: 2 });
        expect(wall.days.find((d) => d.day === "2025-11-20").pieces).toBe(3);
        expect(wall.pieces).toBe(8);
    });

    it("sets the inlays it can prove: boards owned, a thousand pieces, and recorded firsts", () => {
        const owned = Array.from({ length: 10 }, (_unused, n) => ({ createdAt: `2026-0${(n % 9) + 1}-01T00:00:00Z` }));
        const wall = buildWall(
            [null, { days: { "2026-11-01": { pieces: 600 }, "2026-11-10": { pieces: 500 } }, firsts: { firstMerge: "2026-10-01T00:00:00Z" } }],
            { now, ownedBoards: owned },
        );
        const at = Object.fromEntries(wall.firsts.map((first) => [first.name, first.at]));
        expect(at.firstBoard).toBe("2026-01-01T00:00:00Z");
        expect(at.tenBoards).toBe("2026-09-01T00:00:00Z");
        expect(at.thousandPieces).toBe("2026-11-10");
        expect(at.firstMerge).toBe("2026-10-01T00:00:00Z");
        expect(at.roomOfFive).toBeNull();
    });
});
