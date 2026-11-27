import { describe, it, expect } from "vitest";
import { getRole, hasEditAccess, hasDeleteAccess, ROLES } from "../accessControl.js";

const board = (extra = {}) => ({ shareId: "b1", owner: "owner", collaborators: [{ userId: "ed", role: "editor" }], ...extra });

describe("roles for tokens and agents", () => {
    it("keeps plain user ids working as before", () => {
        expect(getRole(board(), "owner")).toBe(ROLES.OWNER);
        expect(getRole(board(), "ed")).toBe(ROLES.EDITOR);
        expect(getRole(board(), "stranger")).toBeNull();
    });

    it("caps a read-only token at viewer, even for the owner", () => {
        expect(getRole(board(), { userId: "owner", scope: "read" })).toBe(ROLES.VIEWER);
        expect(hasEditAccess(board(), { userId: "ed", scope: "read" })).toBe(false);
    });

    it("shows a token limited to some boards nothing of the others", () => {
        expect(getRole(board(), { userId: "owner", boards: ["other"] })).toBeNull();
        expect(getRole(board(), { userId: "owner", boards: ["b1"] })).toBe(ROLES.OWNER);
    });

    it("never lets an agent delete the board or manage access, and follows the owner's agent setting", () => {
        expect(getRole(board(), { userId: "owner", agent: "Claude" })).toBe(ROLES.EDITOR);
        expect(hasDeleteAccess(board(), { userId: "owner", agent: "Claude" })).toBe(false);
        expect(getRole(board({ agentAccess: "comment" }), { userId: "ed", agent: "Claude" })).toBe(ROLES.COMMENTER);
        expect(getRole(board({ agentAccess: "none" }), { userId: "ed", agent: "Claude" })).toBeNull();
    });

    it("lets anyone signed in view a board shared by link, and no more", () => {
        expect(getRole(board({ linkAccess: "viewer" }), "stranger")).toBe(ROLES.VIEWER);
        expect(getRole(board({ linkAccess: "viewer" }), "ed")).toBe(ROLES.EDITOR);
    });
});
