import { z } from "zod";
import logger from "../../observability/logger.js";
import Drawing from "../../models/drawingSchema.js";
import { nullIfMissing } from "../../db/errors.js";
import { startSession, refreshSession, ACCESS_TOKEN_SECONDS } from "../../auth/sessionTokens.js";
import { appUrl } from "../origins.js";
import {
    mcpResourceUrl,
    OAUTH_SCOPES,
    isAcceptableRedirect,
    registerClient,
    checkAuthorizationRequest,
    issueCode,
    redeemCode,
    authorizationServerMetadata,
    protectedResourceMetadata,
} from "../../auth/oauthServer.js";
import { shareIdListSchema } from "../../validation/restSchemas.js";

const oauthError = (res, status, error, description) => res.status(status).json({ error, error_description: description });

const protectedResource = (req, res) => res.status(200).json(protectedResourceMetadata());
const authorizationServer = (req, res) => res.status(200).json(authorizationServerMetadata());

const registrationSchema = z.object({
    client_name: z.string().trim().min(1).max(80).default("Agent app"),
    client_uri: z.string().url().max(300).optional(),
    redirect_uris: z.array(z.string().max(500)).min(1).max(10),
    token_endpoint_auth_method: z.literal("none").default("none"),
});

// Dynamic client registration (RFC 7591), for apps without a metadata document.
const register = async (req, res) => {
    const parsed = registrationSchema.safeParse(req.body ?? {});
    if (!parsed.success) return oauthError(res, 400, "invalid_client_metadata", parsed.error.issues[0]?.message ?? "Invalid registration.");
    const { client_name: clientName, client_uri: clientUri, redirect_uris: redirectUris } = parsed.data;
    if (!redirectUris.every(isAcceptableRedirect))
        return oauthError(res, 400, "invalid_redirect_uri", "Redirects must use https, return to this machine over http, or use the app's own scheme.");
    try {
        const client = await registerClient({ clientName, redirectUris, clientUri });
        return res.status(201).json({
            client_id: client.clientId,
            client_id_issued_at: Math.floor(client.createdAt / 1000),
            client_name: clientName,
            redirect_uris: redirectUris,
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
        });
    } catch (error) {
        logger.error({ err: error }, "error registering an oauth client");
        return oauthError(res, 500, "server_error", "Registration failed.");
    }
};

// What the consent screen shows about the app asking.
const describeClient = async (req, res) => {
    const { client_id: clientId, redirect_uri: redirectUri } = req.query;
    const { client, error } = await checkAuthorizationRequest({ clientId, redirectUri });
    if (error) return res.status(400).json({ message: error });
    return res
        .status(200)
        .json({ clientName: client.clientName, clientUri: client.clientUri ?? null, redirectHost: new URL(redirectUri).host || new URL(redirectUri).protocol });
};

const approvalSchema = z.object({
    client_id: z.string().min(1).max(500),
    redirect_uri: z.string().min(1).max(500),
    code_challenge: z.string().min(43).max(128),
    code_challenge_method: z.literal("S256"),
    state: z.string().max(500).optional(),
    resource: z.string().max(500).optional(),
    scope: z.enum(OAUTH_SCOPES),
    boards: shareIdListSchema.optional(),
});

// The person, signed in on the consent screen, allows the app in.
const approve = async (req, res) => {
    const parsed = approvalSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request." });
    const { client_id: clientId, redirect_uri: redirectUri, code_challenge: codeChallenge, state, resource, scope, boards } = parsed.data;
    if (resource && resource !== mcpResourceUrl()) return res.status(400).json({ message: "This app asked for access to something other than Mosaic." });
    try {
        const { client, error } = await checkAuthorizationRequest({ clientId, redirectUri });
        if (error) return res.status(400).json({ message: error });
        for (const shareId of boards ?? []) {
            const drawing = await nullIfMissing(() => Drawing.findOne({ shareId }));
            if (!drawing?.hasViewAccess(req.user)) return res.status(400).json({ message: `You don't have access to board ${shareId}.` });
        }
        const code = await issueCode({
            clientId,
            clientName: client.clientName,
            userId: req.user.userId,
            redirectUri,
            codeChallenge,
            scope,
            boards: boards?.length ? boards : null,
        });
        const target = new URL(redirectUri);
        target.searchParams.set("code", code);
        target.searchParams.set("iss", appUrl());
        if (state) target.searchParams.set("state", state);
        return res.status(200).json({ redirect: target.toString() });
    } catch (error) {
        logger.error({ err: error }, "error approving an oauth request");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const tokenResponse = (pair, scope) => ({
    access_token: pair.token,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: pair.refreshToken,
    scope,
});

const token = async (req, res) => {
    res.set("Cache-Control", "no-store");
    const { grant_type: grantType, client_id: clientId } = req.body ?? {};
    try {
        if (grantType === "authorization_code") {
            const grant = await redeemCode({ code: req.body.code, clientId, redirectUri: req.body.redirect_uri, codeVerifier: req.body.code_verifier });
            if (!grant) return oauthError(res, 400, "invalid_grant", "The code is invalid, used or expired, or the verifier doesn't match.");
            const pair = await startSession(grant.userId, {
                grant: { kind: "oauth", clientId, agent: grant.clientName, scope: grant.scope, boards: grant.boards },
            });
            return res.status(200).json(tokenResponse(pair, grant.scope));
        }
        if (grantType === "refresh_token") {
            const pair = await refreshSession(req.body.refresh_token, { clientId: clientId ?? null });
            if (!pair) return oauthError(res, 400, "invalid_grant", "This sign-in has ended. Connect the app again.");
            return res.status(200).json(tokenResponse(pair, undefined));
        }
        return oauthError(res, 400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
    } catch (error) {
        logger.error({ err: error }, "error issuing an oauth token");
        return oauthError(res, 500, "server_error", "Couldn't issue a token.");
    }
};

export { protectedResource, authorizationServer, register, describeClient, approve, token };
