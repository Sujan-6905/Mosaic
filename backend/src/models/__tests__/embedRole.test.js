import { describe, it, expect } from "vitest";
import { embedRole, getRole, linkRole } from "../accessControl.js";

const board = (extra) => ({ shareId: "b1", owner: "owner", collaborators: [], ...extra });

describe("who may see an embed", () => {
    it("shows a board shared by link to anyone, but only where its owner turned embedding on", () => {
        expect(embedRole(board({ linkAccess: "viewer", embed: { enabled: true, sites: [] } }), null)).toBe("viewer");
        expect(embedRole(board({ linkAccess: "viewer", embed: { enabled: false, sites: [] } }), null)).toBeNull();
    });

    it("asks everyone to sign in for a board shared with its collaborators only", () => {
        expect(embedRole(board({ linkAccess: "none", embed: { enabled: true, sites: [] } }), null)).toBeNull();
        expect(embedRole(board({ linkAccess: "none", embed: { enabled: true, sites: [] } }), { userId: "owner" })).toBe("owner");
    });
});

describe("who may see a board from its link", () => {
    it("shows a board shared by link to anyone, with no account, whether or not it may be embedded", () => {
        expect(linkRole(board({ linkAccess: "viewer", embed: { enabled: false, sites: [] } }), null)).toBe("viewer");
    });

    it("shows a private board only to the people on it", () => {
        expect(linkRole(board({ linkAccess: "none" }), null)).toBeNull();
        expect(linkRole(board({ linkAccess: "none" }), { userId: "owner" })).toBe("owner");
        expect(linkRole(board({ linkAccess: "none" }), { userId: "stranger" })).toBeNull();
    });
});

describe("edit and comment links", () => {
    it("give anyone signed in with the link that role, and a signed-out visitor only a view", () => {
        const editLink = board({ linkAccess: "editor" });
        expect(getRole(editLink, { userId: "stranger" })).toBe("editor");
        expect(linkRole(editLink, null)).toBe("viewer");
        expect(getRole(board({ linkAccess: "commenter" }), { userId: "stranger" })).toBe("commenter");
    });

    it("never lower an invited person's own role, and stay within what a token or agent may do", () => {
        const editLink = board({ linkAccess: "editor", collaborators: [{ userId: "ann", role: "viewer" }] });
        expect(getRole(editLink, { userId: "ann" })).toBe("viewer");
        expect(getRole(editLink, { userId: "stranger", scope: "read" })).toBe("viewer");
    });

    it("let an agent, a board-limited token or an embed's sign-in only view through the link alone", () => {
        const editLink = board({ linkAccess: "editor" });
        expect(getRole(editLink, { userId: "stranger", agent: "bot" })).toBe("viewer");
        expect(getRole(editLink, { userId: "stranger", boards: ["b1"] })).toBe("viewer");
        expect(getRole(board({ linkAccess: "editor", collaborators: [{ userId: "ann", role: "editor" }] }), { userId: "ann", boards: ["b1"] })).toBe("editor");
    });

    it("ignore a link setting that isn't one of the roles", () => {
        expect(getRole(board({ linkAccess: "owner" }), { userId: "stranger" })).toBeNull();
    });
});
