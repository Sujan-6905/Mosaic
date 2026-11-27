import { describe, it, expect, vi } from "vitest";

vi.mock("../../models/commentSchema.js", () => ({ default: {} }));

const { findMentionedUserIds } = await import("../comments.js");

const people = new Map([
    ["u1", "ana"],
    ["u2", "ana_lee"],
    ["u3", "raj"],
]);

describe("findMentionedUserIds", () => {
    it("finds a name wherever it sits", () => {
        expect(findMentionedUserIds("hey @raj look at this", people)).toEqual(["u3"]);
        expect(findMentionedUserIds("@raj", people)).toEqual(["u3"]);
        expect(findMentionedUserIds("thanks @raj.", people)).toEqual(["u3"]);
    });

    it("doesn't take a longer name for a shorter one", () => {
        expect(findMentionedUserIds("hi @ana_lee", people)).toEqual(["u2"]);
    });

    it("finds a shorter name after a longer one that starts the same", () => {
        expect(findMentionedUserIds("@ana_lee and @ana", people).sort()).toEqual(["u1", "u2"]);
    });

    it("ignores people who aren't on the board and text without a mention", () => {
        expect(findMentionedUserIds("@stranger hello", people)).toEqual([]);
        expect(findMentionedUserIds("ana raj", people)).toEqual([]);
    });
});
