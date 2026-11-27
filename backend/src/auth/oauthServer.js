// OAuth 2.1 for hosted MCP: apps register or present a metadata document, the person
// approves, and the code becomes a sign-in limited to what they allowed.
import crypto from "node:crypto";
import { getCollection } from "ottoman";
import { nullIfMissing } from "../db/errors.js";
import { downloadPublic } from "../../../mcp-server/src/connection/publicFetch.js";
import { appUrl } from "../http/origins.js";

const CODE_SECONDS = 60;
const CLIENT_SECONDS = 180 * 24 * 60 * 60;
const MAX_METADATA_BYTES = 8 * 1024;
const METADATA_CACHE_MS = 10 * 60 * 1000;
export const OAUTH_SCOPES = ["read", "write"];

const defaultStore = () => getCollection("refreshTokens", "app");
const hashOf = (value) => crypto.createHash("sha256").update(value).digest("hex");
const clientKey = (clientId) => `oauthclient::${clientId}`;
const codeKey = (code) => `oauthcode::${hashOf(code)}`;

export const mcpResourceUrl = () => `${appUrl()}/mcp`;

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// https anywhere, http only back to this machine, or an app's own scheme (cursor://, vscode://).
export const isAcceptableRedirect = (value) => {
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.hash || BLOCKED_SCHEMES.has(url.protocol)) return false;
    if (url.protocol === "http:") return LOOPBACK_HOSTS.has(url.hostname);
    return true;
};

// Native apps listen on a port they pick at sign-in time, so a loopback
// redirect matches whatever its port (RFC 8252); everything else matches exactly.
const redirectMatches = (registered, given) => {
    if (registered === given) return true;
    try {
        const [a, b] = [new URL(registered), new URL(given)];
        return a.protocol === "http:" && LOOPBACK_HOSTS.has(a.hostname) && a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search;
    } catch {
        return false;
    }
};

export const registerClient = async ({ clientName, redirectUris, clientUri = null }, { store = defaultStore() } = {}) => {
    const clientId = crypto.randomUUID();
    const record = { clientName, redirectUris, clientUri, createdAt: Date.now() };
    await store.insert(clientKey(clientId), record, { expiry: CLIENT_SECONDS });
    return { clientId, ...record };
};

const metadataCache = new Map();

// A client that names itself by an https URL publishes its own registration there.
const clientFromMetadataDocument = async (clientId) => {
    const cached = metadataCache.get(clientId);
    if (cached && Date.now() - cached.at < METADATA_CACHE_MS) return cached.client;
    let client = null;
    try {
        const document = JSON.parse(
            (await downloadPublic(clientId, { maxBytes: MAX_METADATA_BYTES, timeoutMs: 5000, accept: "application/json" })).toString("utf8"),
        );
        const redirectUris = Array.isArray(document.redirect_uris)
            ? document.redirect_uris.filter((uri) => typeof uri === "string" && isAcceptableRedirect(uri))
            : [];
        if (document.client_id === clientId && redirectUris.length) {
            client = {
                clientId,
                clientName: String(document.client_name || new URL(clientId).hostname).slice(0, 80),
                redirectUris,
                clientUri: typeof document.client_uri === "string" ? document.client_uri : null,
            };
        }
    } catch {
        client = null;
    }
    metadataCache.set(clientId, { client, at: Date.now() });
    return client;
};

const findClient = async (clientId, { store = defaultStore() } = {}) => {
    if (typeof clientId !== "string" || clientId.length > 500) return null;
    if (clientId.startsWith("https://")) return clientFromMetadataDocument(clientId);
    const found = await nullIfMissing(() => store.get(clientKey(clientId)));
    return found ? { clientId, ...found.content } : null;
};

// The client and redirect a consent screen may show, or why it can't.
export const checkAuthorizationRequest = async ({ clientId, redirectUri }, options) => {
    const client = await findClient(clientId, options);
    if (!client) return { error: "This app isn't registered with Mosaic." };
    if (!client.redirectUris.some((registered) => redirectMatches(registered, redirectUri)))
        return { error: "This app asked to return somewhere it didn't register." };
    return { client };
};

export const issueCode = async (grant, { store = defaultStore() } = {}) => {
    const code = crypto.randomBytes(32).toString("base64url");
    await store.insert(codeKey(code), { ...grant, expiresAt: Date.now() + CODE_SECONDS * 1000 }, { expiry: CODE_SECONDS });
    return code;
};

const pkceMatches = (verifier, challenge) =>
    typeof verifier === "string" &&
    verifier.length >= 43 &&
    verifier.length <= 128 &&
    crypto.createHash("sha256").update(verifier).digest("base64url") === challenge;

// A code works once, within a minute, for the client and redirect it was issued to, with the verifier behind its challenge.
export const redeemCode = async ({ code, clientId, redirectUri, codeVerifier }, { store = defaultStore() } = {}) => {
    if (typeof code !== "string" || code.length > 100) return null;
    const found = await nullIfMissing(() => store.get(codeKey(code)));
    if (!found) return null;
    try {
        await store.remove(codeKey(code), { cas: found.cas });
    } catch {
        return null;
    }
    const grant = found.content;
    if (grant.expiresAt <= Date.now() || grant.clientId !== clientId || grant.redirectUri !== redirectUri || !pkceMatches(codeVerifier, grant.codeChallenge))
        return null;
    return grant;
};

export const authorizationServerMetadata = () => ({
    issuer: appUrl(),
    authorization_endpoint: `${appUrl()}/oauth/authorize`,
    token_endpoint: `${appUrl()}/oauth/token`,
    registration_endpoint: `${appUrl()}/oauth/register`,
    scopes_supported: OAUTH_SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
});

export const protectedResourceMetadata = () => ({
    resource: mcpResourceUrl(),
    authorization_servers: [appUrl()],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Mosaic",
    resource_documentation: `${appUrl()}/help`,
});
