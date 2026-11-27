import { describe, it, expect } from "vitest";
import { createWall } from "../wall.js";
import { fakeKvCollection } from "../../../test/fakeKvCollection.js";
import { WALL_COLS, WALL_ROWS, WALL_SIZE } from "../../../../shared/rules/landingWall.js";

const VISITOR = "visitor-aaaaaaaaaaaa";
const OTHER = "visitor-bbbbbbbbbbbb";

const wallWith = (store = fakeKvCollection(), clock = { t: 0 }) => ({ store, clock, wall: createWall({ collection: () => store, now: () => clock.t }) });

describe("the landing wall", () => {
    it("sets one stone where the visitor asked and shows it as theirs", async () => {
        const { wall } = wallWith();
        expect(await wall.setStone(VISITOR, 100)).toEqual({ status: "set", index: 100 });
        const seen = await wall.view(VISITOR);
        expect(seen).toMatchObject({ cols: WALL_COLS, rows: WALL_ROWS, stones: [100], mine: 100 });
    });

    it("keeps each browser to a single stone", async () => {
        const { wall } = wallWith();
        await wall.setStone(VISITOR, 5);
        expect(await wall.setStone(VISITOR, 6)).toEqual({ status: "already", index: 5 });
        expect((await wall.view()).stones).toEqual([5]);
    });

    it("moves a second visitor to the nearest open spot when theirs was just taken", async () => {
        const { wall } = wallWith();
        await wall.setStone(VISITOR, 200);
        const second = await wall.setStone(OTHER, 200);
        expect(second.status).toBe("set");
        expect(second.index).not.toBe(200);
        const [x, y] = [second.index % WALL_COLS, Math.floor(second.index / WALL_COLS)];
        expect(Math.hypot(x - (200 % WALL_COLS), y - Math.floor(200 / WALL_COLS))).toBeLessThanOrEqual(1);
    });

    it("never lets two visitors racing for the same spot both have it", async () => {
        const { wall } = wallWith();
        const results = await Promise.all([wall.setStone(VISITOR, 300), wall.setStone(OTHER, 300)]);
        const spots = results.map((result) => result.index);
        expect(new Set(spots).size).toBe(2);
        expect((await wall.view()).stones.sort()).toEqual([...spots].sort());
    });

    it("gives the claim back when the wall is already finished", async () => {
        const store = fakeKvCollection();
        await store.insert("ledger", { stones: Array.from({ length: WALL_SIZE }, (_, index) => index) });
        const { wall } = wallWith(store);
        expect(await wall.setStone(VISITOR, 1)).toEqual({ status: "full" });
        expect((await wall.view(VISITOR)).mine).toBeNull();
    });

    it("counts the people who looked in the last half minute", async () => {
        const { wall, clock } = wallWith();
        await wall.view(VISITOR);
        clock.t = 10_000;
        expect((await wall.view(OTHER)).here).toBe(2);
        clock.t = 45_000;
        expect((await wall.view(OTHER)).here).toBe(1);
    });

    it("ignores a malformed visitor id when reading", async () => {
        const { wall } = wallWith();
        expect(await wall.view("<script>")).toMatchObject({ mine: null, here: 0 });
    });
});
