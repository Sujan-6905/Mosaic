import { describe, it, expect } from "vitest";
import { nextTimer, nextVotes, publicVoting, tallyVotes } from "../workshop.js";

describe("nextTimer", () => {
    const started = nextTimer(null, { action: "start", durationMs: 300_000 }, 1_000, "Ada");

    it("starts counting down from now", () => {
        expect(started).toEqual({ durationMs: 300_000, running: true, endsAt: 301_000, remainingMs: 300_000, startedByName: "Ada" });
    });

    it("pauses with what's left and resumes from it", () => {
        const paused = nextTimer(started, { action: "pause" }, 101_000);
        expect(paused).toMatchObject({ running: false, endsAt: null, remainingMs: 200_000 });
        expect(nextTimer(paused, { action: "resume" }, 500_000)).toMatchObject({ running: true, endsAt: 700_000 });
    });

    it("adds a minute to what's left, running or paused, and restarts one that ran out", () => {
        expect(nextTimer(started, { action: "extend" }, 101_000)).toMatchObject({ running: true, endsAt: 361_000, remainingMs: 260_000 });
        expect(nextTimer(started, { action: "extend" }, 400_000)).toMatchObject({ running: true, endsAt: 460_000 });
    });

    it("ends on reset and ignores changes when no timer runs", () => {
        expect(nextTimer(started, { action: "reset" }, 2_000)).toBeNull();
        expect(nextTimer(null, { action: "pause" }, 2_000)).toBeNull();
    });
});

describe("votes", () => {
    it("places votes up to the limit, more than one on an element allowed", () => {
        expect(nextVotes(["a"], "a", true, 3)).toEqual(["a", "a"]);
        expect(nextVotes(["a", "b", "c"], "d", true, 3)).toBeNull();
    });

    it("takes back one vote from an element", () => {
        expect(nextVotes(["a", "b", "a"], "a", false, 3)).toEqual(["a", "b"]);
        expect(nextVotes(["a"], "z", false, 3)).toBeNull();
    });

    it("tallies everyone's votes, most first", () => {
        expect(tallyVotes({ ada: ["x", "y"], ben: ["y"], cy: [] })).toEqual([
            { elementId: "y", count: 2 },
            { elementId: "x", count: 1 },
        ]);
    });

    it("shows how many voted while open, and the results only once closed", () => {
        const open = { status: "open", votesPerPerson: 3, startedByName: "Ada", results: null };
        expect(publicVoting(open, { ada: ["x"], ben: [] })).toEqual({ status: "open", votesPerPerson: 3, startedByName: "Ada", voterCount: 1, results: null });
        const closed = { ...open, status: "closed", results: [{ elementId: "x", count: 1 }] };
        expect(publicVoting(closed, {}).results).toEqual([{ elementId: "x", count: 1 }]);
    });
});
