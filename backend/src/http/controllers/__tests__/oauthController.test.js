import crypto from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { fakeKvCollection } from "../../../../test/fakeKvCollection.js";

let store = fakeKvCollection();
vi.mock("ottoman", () => ({ getCollection: vi.fn(() => store) }));
vi.mock("../../../models/drawingSchema.js", () => ({
    default: { findOne: vi.fn(async ({ shareId }) => ({ shareId, hasViewAccess: () => shareId !== "secret" })) },
}));

const { wellKnownRouter, oauthRouter, oauthApiRouter } = await import("../../routes/oauthRoutes.js");
const { startSession } = await import("../../../auth/sessionTokens.js");

const app = express();
app.use(express.json());
app.use("/.well-known", wellKnownRouter);
app.use("/oauth", oauthRouter);
app.use("/api/oauth", oauthApiRouter);

const verifier = crypto.randomBytes(40).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const REDIRECT = "http://127.0.0.1:33418/callback";

const register = async () =>
    (
        await request(app)
            .post("/oauth/register")
            .send({ client_name: "Claude", redirect_uris: [REDIRECT] })
    ).body.client_id;

const approve = async (clientId, browserToken, extra = {}) =>
    request(app)
        .post("/api/oauth/authorize")
        .set("Authorization", `Bearer ${browserToken}`)
        .send({
            client_id: clientId,
            redirect_uri: REDIRECT,
            code_challenge: challenge,
            code_challenge_method: "S256",
            state: "s1",
            scope: "read",
            ...extra,
        });

const codeFrom = (redirect) => new URL(redirect).searchParams.get("code");

beforeEach(() => {
    store = fakeKvCollection();
});

describe("hosted MCP sign-in (OAuth 2.1)", () => {
    it("publishes where to sign in and what the MCP endpoint is", async () => {
        const resource = await request(app).get("/.well-known/oauth-protected-resource/mcp");
        expect(resource.body.resource).toMatch(/\/mcp$/);
        const server = await request(app).get("/.well-known/oauth-authorization-server");
        expect(server.body.code_challenge_methods_supported).toEqual(["S256"]);
        expect(server.body.client_id_metadata_document_supported).toBe(true);
    });

    it("runs the whole flow: register, approve, swap the code, renew", async () => {
        const clientId = await register();
        const browser = await startSession("u1");
        const approved = await approve(clientId, browser.token);
        expect(approved.status).toBe(200);
        expect(new URL(approved.body.redirect).searchParams.get("state")).toBe("s1");

        const tokens = await request(app)
            .post("/oauth/token")
            .type("form")
            .send({
                grant_type: "authorization_code",
                code: codeFrom(approved.body.redirect),
                client_id: clientId,
                redirect_uri: REDIRECT,
                code_verifier: verifier,
            });
        expect(tokens.status).toBe(200);
        expect(jwt.verify(tokens.body.access_token, process.env.JWT_SECRET)).toMatchObject({ userId: "u1", scope: "read", agent: "Claude", clientId });

        const renewed = await request(app)
            .post("/oauth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token, client_id: clientId });
        expect(renewed.status).toBe(200);
    });

    it("refuses a code twice, with the wrong verifier, or for another app", async () => {
        const clientId = await register();
        const otherClient = await register();
        const browser = await startSession("u1");
        const swap = (code, extra = {}) =>
            request(app)
                .post("/oauth/token")
                .type("form")
                .send({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier, ...extra });

        const wrongVerifier = codeFrom((await approve(clientId, browser.token)).body.redirect);
        expect((await swap(wrongVerifier, { code_verifier: "x".repeat(50) })).status).toBe(400);

        const wrongClient = codeFrom((await approve(clientId, browser.token)).body.redirect);
        expect((await swap(wrongClient, { client_id: otherClient })).status).toBe(400);

        const once = codeFrom((await approve(clientId, browser.token)).body.redirect);
        expect((await swap(once)).status).toBe(200);
        expect((await swap(once)).status).toBe(400);
    });

    it("won't hand one app's refresh token to another", async () => {
        const clientId = await register();
        const otherClient = await register();
        const browser = await startSession("u1");
        const code = codeFrom((await approve(clientId, browser.token)).body.redirect);
        const tokens = await request(app)
            .post("/oauth/token")
            .type("form")
            .send({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: REDIRECT, code_verifier: verifier });
        const stolen = await request(app)
            .post("/oauth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token, client_id: otherClient });
        expect(stolen.status).toBe(400);
    });

    it("rejects redirects an app didn't register and redirect schemes that could run code", async () => {
        const clientId = await register();
        const browser = await startSession("u1");
        expect((await approve(clientId, browser.token, { redirect_uri: "https://evil.example/cb" })).status).toBe(400);
        const bad = await request(app)
            .post("/oauth/register")
            .send({ client_name: "x", redirect_uris: ["javascript:alert(1)"] });
        expect(bad.status).toBe(400);
        expect(
            (
                await request(app)
                    .post("/oauth/register")
                    .send({ client_name: "x", redirect_uris: ["http://evil.example/cb"] })
            ).status,
        ).toBe(400);
    });

    it("lets a person limit an app only to boards they can open, and never lets an agent approve an app", async () => {
        const clientId = await register();
        const browser = await startSession("u1");
        expect((await approve(clientId, browser.token, { boards: ["secret"] })).status).toBe(400);
        const agent = await startSession("u1", { grant: { kind: "oauth", agent: "Claude", scope: "write" } });
        expect((await approve(clientId, agent.token)).status).toBe(403);
    });
});
