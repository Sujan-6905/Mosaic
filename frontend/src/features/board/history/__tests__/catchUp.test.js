import { describe, it, expect } from "vitest";
import { boundsOfChanges, describeCatchUp, describeChange, describeChangeAuthors, describeSince, sinceForRange } from "../catchUp.js";

const digest = (overrides = {}) => ({ people: [{ name: "Ana" }], changes: [{}], moreChangeCount: 0, comments: [], moreCommentCount: 0, ...overrides });

describe("describeCatchUp", () => {
    it("says who changed how much", () => {
        expect(describeCatchUp(digest())).toBe("Ana made 1 change.");
        expect(describeCatchUp(digest({ people: [{ name: "Ana" }, { name: "Raj" }], moreChangeCount: 4 }))).toBe("Ana and Raj made 5 changes.");
    });

    it("shortens a long list of people", () => {
        const people = ["Ana", "Raj", "Li", "Sam"].map((name) => ({ name }));
        expect(describeCatchUp(digest({ people }))).toBe("Ana, Raj and 2 others made 1 change.");
    });

    it("counts comments and calls out mentions", () => {
        const comments = [{ mentionsYou: true }, { mentionsYou: false }];
        expect(describeCatchUp(digest({ changes: [], people: [], comments }))).toBe("2 new comments, 1 mentioning you.");
    });
});

describe("describeChange", () => {
    it("reads as an action on the object", () => {
        expect(describeChange({ kind: "moved", name: "Login box" })).toBe("Moved Login box");
    });
});

describe("describeChangeAuthors", () => {
    it("credits the assistant alongside the person who asked", () => {
        expect(describeChangeAuthors({ authorNames: ["Ana"], viaAssistant: true })).toBe("Ana with the assistant");
    });
});

describe("describeSince", () => {
    const now = new Date("2026-03-10T12:00:00Z").getTime();

    it("uses hours for the first two days, then days", () => {
        expect(describeSince("2026-03-10T11:30:00Z", now)).toBe("In the last hour");
        expect(describeSince("2026-03-10T09:00:00Z", now)).toBe("In the last 3 hours");
        expect(describeSince("2026-03-07T12:00:00Z", now)).toBe("In the last 3 days");
    });
});

describe("sinceForRange", () => {
    it("leaves the last visit for the server to look up", () => {
        expect(sinceForRange("visit")).toBeNull();
    });

    it("counts back from now for a fixed range", () => {
        const now = new Date("2026-03-10T12:00:00Z").getTime();
        expect(sinceForRange("day", now)).toBe("2026-03-09T12:00:00.000Z");
        expect(sinceForRange("week", now)).toBe("2026-03-03T12:00:00.000Z");
    });
});

describe("boundsOfChanges", () => {
    it("covers every change that has a place on the board", () => {
        const a = { bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 } };
        const b = { bounds: { minX: 50, minY: -5, maxX: 60, maxY: 5 } };
        expect(boundsOfChanges([a, { bounds: null }, b])).toEqual({ minX: 0, minY: -5, maxX: 60, maxY: 10 });
    });

    it("is null when none do", () => {
        expect(boundsOfChanges([{ bounds: null }])).toBeNull();
    });
});
