// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encode } from "next-auth/jwt";
import { pendingOAuthDraft } from "../oauthBridge";

const SECRET = "test-nextauth-secret";
process.env.NEXTAUTH_SECRET = SECRET;

const requestWith = async (token) => ({ headers: { cookie: `other=1; next-auth.session-token=${await encode({ token, secret: SECRET })}` } });

describe("pendingOAuthDraft", () => {
    it("reads the draft from the signed session, not from what the browser sends", async () => {
        const draft = { provider: "github", providerAccountId: "42", email: "me@example.com" };
        expect(await pendingOAuthDraft(await requestWith({ needsUsername: true, oauthDraft: draft }))).toEqual(draft);
    });

    it("has no draft for a forged cookie, a finished sign-in or no cookie at all", async () => {
        expect(await pendingOAuthDraft({ headers: { cookie: "next-auth.session-token=forged" } })).toBeNull();
        expect(await pendingOAuthDraft(await requestWith({ accessToken: "x", oauthDraft: { email: "a@b.c" } }))).toBeNull();
        expect(await pendingOAuthDraft({ headers: {} })).toBeNull();
    });
});
