import { describe, it, expect } from "vitest";
import {
    resolveCommentWorldPosition,
    isCommentUnreadFor,
    isCommentMine,
    splitMentionSegments,
    extractMentionedUserIds,
    findActiveMentionQuery,
    insertMention,
} from "../comments";

describe("resolveCommentWorldPosition", () => {
    it("returns the stored point directly for a point anchor", () => {
        const comment = { anchorType: "point", x: 10, y: 20 };
        expect(resolveCommentWorldPosition(comment, {})).toEqual({ x: 10, y: 20 });
    });

    it("re-derives the position from the bound element's live bounds for an element anchor", () => {
        const comment = { anchorType: "element", elementId: "el-1" };
        const elements = { "el-1": { type: "shape", startX: 0, startY: 0, endX: 10, endY: 20 } };
        expect(resolveCommentWorldPosition(comment, elements)).toEqual({ x: 5, y: 10 });
    });

    it("returns null when an element anchor's target no longer exists", () => {
        const comment = { anchorType: "element", elementId: "deleted-el" };
        expect(resolveCommentWorldPosition(comment, {})).toBeNull();
    });
});

describe("isCommentUnreadFor", () => {
    it("is unread when the user is mentioned in the root comment and hasn't acknowledged it", () => {
        const comment = { mentions: ["user-a"], replies: [], readBy: [] };
        expect(isCommentUnreadFor(comment, "user-a")).toBe(true);
    });

    it("is unread when the user is mentioned only in a reply", () => {
        const comment = { mentions: [], replies: [{ mentions: ["user-a"] }], readBy: [] };
        expect(isCommentUnreadFor(comment, "user-a")).toBe(true);
    });

    it("is read once the user appears in readBy", () => {
        const comment = { mentions: ["user-a"], replies: [], readBy: ["user-a"] };
        expect(isCommentUnreadFor(comment, "user-a")).toBe(false);
    });

    it("is not unread for a user who was never mentioned", () => {
        const comment = { mentions: ["user-b"], replies: [], readBy: [] };
        expect(isCommentUnreadFor(comment, "user-a")).toBe(false);
    });
});

describe("isCommentMine", () => {
    it("matches the comment's authorId", () => {
        expect(isCommentMine({ authorId: "user-a" }, "user-a")).toBe(true);
        expect(isCommentMine({ authorId: "user-b" }, "user-a")).toBe(false);
    });
});

describe("splitMentionSegments", () => {
    it("splits plain text with an embedded mention into segments", () => {
        expect(splitMentionSegments("hey @ada check this", ["ada"])).toEqual([
            { text: "hey ", isMention: false },
            { text: "@ada", isMention: true },
            { text: " check this", isMention: false },
        ]);
    });

    it("prefers the longest matching username so a shorter name doesn't shadow a longer one", () => {
        expect(splitMentionSegments("@adam is here", ["ada", "adam"])).toEqual([
            { text: "@adam", isMention: true },
            { text: " is here", isMention: false },
        ]);
    });

    it("does not treat an unknown username as a mention", () => {
        expect(splitMentionSegments("hey @stranger", ["ada"])).toEqual([{ text: "hey @stranger", isMention: false }]);
    });

    it("returns the whole text unsegmented when there are no known usernames", () => {
        expect(splitMentionSegments("hey @ada", [])).toEqual([{ text: "hey @ada", isMention: false }]);
    });
});

describe("extractMentionedUserIds", () => {
    const collaborators = [
        { userId: "u1", username: "ada" },
        { userId: "u2", username: "bob" },
    ];

    it("resolves matched usernames to userIds, deduped and ignoring unknown handles", () => {
        expect(extractMentionedUserIds("hey @ada and @ada, also @bob and @ghost", collaborators)).toEqual(["u1", "u2"]);
    });

    it("returns an empty array when nothing matches", () => {
        expect(extractMentionedUserIds("no mentions here", collaborators)).toEqual([]);
    });
});

describe("findActiveMentionQuery", () => {
    it("finds the partial mention the caret is inside", () => {
        expect(findActiveMentionQuery("hey @ad", 7)).toEqual({ query: "ad", start: 4 });
    });

    it("returns null when the caret isn't inside a mention trigger", () => {
        expect(findActiveMentionQuery("hey there", 9)).toBeNull();
    });

    it("returns null once the mention is followed by a space", () => {
        expect(findActiveMentionQuery("hey @ada ", 9)).toBeNull();
    });
});

describe("insertMention", () => {
    it("splices the chosen username in place of the active partial mention", () => {
        const text = "hey @ad checking in";
        const active = findActiveMentionQuery(text, 7);
        const result = insertMention(text, active, "ada");
        expect(result.text).toBe("hey @ada  checking in");
        expect(result.caretIndex).toBe(9);
    });
});
