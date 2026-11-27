import { describe, it, expect } from "vitest";
import { ROLES, getRole, linkRole, embedRole, hasViewAccess, hasCommentAccess, hasEditAccess, hasDeleteAccess } from "../accessControl.js";

const drawing = {
    owner: "u1",
    collaborators: [
        { userId: "u2", role: ROLES.EDITOR },
        { userId: "u3", role: ROLES.COMMENTER },
        { userId: "u4", role: ROLES.VIEWER },
    ],
};

describe("getRole", () => {
    it("resolves the owner regardless of the collaborators array", () => {
        expect(getRole(drawing, "u1")).toBe(ROLES.OWNER);
    });

    it("resolves each collaborator's assigned role", () => {
        expect(getRole(drawing, "u2")).toBe(ROLES.EDITOR);
        expect(getRole(drawing, "u3")).toBe(ROLES.COMMENTER);
        expect(getRole(drawing, "u4")).toBe(ROLES.VIEWER);
    });

    it("returns null for a user with no relationship to the drawing", () => {
        expect(getRole(drawing, "stranger")).toBe(null);
    });
});

describe("hasEditAccess", () => {
    it("grants the owner and an editor", () => {
        expect(hasEditAccess(drawing, "u1")).toBe(true);
        expect(hasEditAccess(drawing, "u2")).toBe(true);
    });

    it("denies a commenter and a viewer", () => {
        expect(hasEditAccess(drawing, "u3")).toBe(false);
        expect(hasEditAccess(drawing, "u4")).toBe(false);
    });

    it("denies a user who is neither owner nor a collaborator", () => {
        expect(hasEditAccess(drawing, "stranger")).toBe(false);
    });
});

describe("hasCommentAccess", () => {
    it("grants owner, editor and commenter", () => {
        expect(hasCommentAccess(drawing, "u1")).toBe(true);
        expect(hasCommentAccess(drawing, "u2")).toBe(true);
        expect(hasCommentAccess(drawing, "u3")).toBe(true);
    });

    it("denies a viewer", () => {
        expect(hasCommentAccess(drawing, "u4")).toBe(false);
    });
});

describe("hasViewAccess", () => {
    it("grants every role including viewer", () => {
        expect(hasViewAccess(drawing, "u1")).toBe(true);
        expect(hasViewAccess(drawing, "u4")).toBe(true);
    });

    it("denies a stranger", () => {
        expect(hasViewAccess(drawing, "stranger")).toBe(false);
    });
});

describe("hasDeleteAccess", () => {
    it("grants only the owner", () => {
        expect(hasDeleteAccess(drawing, "u1")).toBe(true);
    });

    it("denies an editor, commenter and viewer", () => {
        expect(hasDeleteAccess(drawing, "u2")).toBe(false);
        expect(hasDeleteAccess(drawing, "u3")).toBe(false);
        expect(hasDeleteAccess(drawing, "u4")).toBe(false);
    });
});

describe("a swept board", () => {
    const swept = {
        owner: "owner-1",
        collaborators: [{ userId: "editor-1", role: "editor" }],
        linkAccess: "viewer",
        embed: { enabled: true },
        deletedAt: "2026-11-17T09:00:00.000Z",
    };

    it("is out of reach for its owner, its collaborators, its link and its embeds", () => {
        expect(getRole(swept, "owner-1")).toBeNull();
        expect(getRole(swept, "editor-1")).toBeNull();
        expect(linkRole(swept, null)).toBeNull();
        expect(embedRole(swept, null)).toBeNull();
    });

    it("comes back with every role once put back", () => {
        const restored = { ...swept, deletedAt: null };
        expect(getRole(restored, "owner-1")).toBe(ROLES.OWNER);
        expect(linkRole(restored, null)).toBe(ROLES.VIEWER);
    });
});
