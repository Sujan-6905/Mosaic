// Long-lived tokens for agents and scripts: stored hashed, read or write, optionally per
// board, always expiring.
import crypto from "node:crypto";
import { getCollection } from "ottoman";
import { isCasMismatch, isDocumentExists, nullIfMissing } from "../db/errors.js";
import logger from "../observability/logger.js";
import { signInEvents } from "./sessionTokens.js";

const TOKEN_PREFIX = "mosaic_pat_";
const DEFAULT_TOKEN_DAYS = 90;
export const MAX_TOKEN_DAYS = 365;
export const MAX_TOKENS_PER_PERSON = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
// A token's last use is recorded at most this often, so a busy agent isn't a write per request.
const LAST_USED_RESOLUTION_MS = 10 * 60 * 1000;
const LOOKUP_CACHE_MS = 10 * 1000;

const defaultStore = () => getCollection("refreshTokens", "app");
const hashOf = (token) => crypto.createHash("sha256").update(token).digest("hex");
const tokenKey = (hash) => `pat::${hash}`;
const indexKey = (userId) => `pats::${userId}`;
const secondsUntil = (time) => Math.max(1, Math.ceil((time - Date.now()) / 1000));

// The sign-in id a token's sockets and cache entries go by.
const tokenSessionId = (id) => `pat:${id}`;

export const personalTokensAllowed = () => process.env.PERSONAL_TOKENS_DISABLED !== "true";

const updateIndex = async (store, userId, change) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const found = await nullIfMissing(() => store.get(indexKey(userId)));
        const tokens = Object.fromEntries(Object.entries(found?.content.tokens ?? {}).filter(([, token]) => token.expiresAt > Date.now()));
        const next = { tokens: change(tokens) };
        try {
            if (found) await store.replace(indexKey(userId), next, { cas: found.cas });
            else await store.insert(indexKey(userId), next);
            return next.tokens;
        } catch (error) {
            if (!isCasMismatch(error) && !isDocumentExists(error)) throw error;
        }
    }
    throw new Error("gave up updating a token list after repeated concurrent writes");
};

const publicView = (id, token) => ({
    id,
    name: token.name,
    scope: token.scope,
    boards: token.boards,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt ?? null,
});

// Returns the token itself once, at creation; only its hash is kept.
export const createPersonalToken = async (userId, { name, scope, boards = null, days = DEFAULT_TOKEN_DAYS }, { store = defaultStore() } = {}) => {
    const token = TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
    const hash = hashOf(token);
    const id = crypto.randomUUID();
    const record = {
        name,
        scope,
        boards: boards?.length ? boards : null,
        createdAt: Date.now(),
        expiresAt: Date.now() + Math.min(days, MAX_TOKEN_DAYS) * DAY_MS,
    };
    // The token exists before it's listed, so a revoke-all can never miss one that is mid-creation.
    await store.insert(tokenKey(hash), { id, userId, ...record }, { expiry: secondsUntil(record.expiresAt) });
    let tooMany = false;
    await updateIndex(store, userId, (tokens) => {
        tooMany = Object.keys(tokens).length >= MAX_TOKENS_PER_PERSON;
        return tooMany ? tokens : { ...tokens, [id]: { ...record, hash } };
    });
    if (tooMany) {
        await nullIfMissing(() => store.remove(tokenKey(hash)));
        return { error: `You can have up to ${MAX_TOKENS_PER_PERSON} tokens. Revoke one you no longer use.` };
    }
    return { token, ...publicView(id, record) };
};

export const listPersonalTokens = async (userId, { store = defaultStore() } = {}) => {
    const found = await nullIfMissing(() => store.get(indexKey(userId)));
    return Object.entries(found?.content.tokens ?? {})
        .filter(([, token]) => token.expiresAt > Date.now())
        .map(([id, token]) => publicView(id, token))
        .sort((a, b) => b.createdAt - a.createdAt);
};

const lookupCache = new Map();

export const revokePersonalToken = async (userId, id, { store = defaultStore() } = {}) => {
    let hash = null;
    await updateIndex(store, userId, (tokens) => {
        hash = tokens[id]?.hash ?? null;
        const rest = { ...tokens };
        delete rest[id];
        return rest;
    });
    if (!hash) return false;
    await nullIfMissing(() => store.remove(tokenKey(hash)));
    lookupCache.delete(hash);
    signInEvents.emit("ended", tokenSessionId(id));
    return true;
};

// Ends every token the person holds, for a password change or "sign out everywhere else"; returns how many.
export const revokeAllPersonalTokens = async (userId, { store = defaultStore() } = {}) => {
    let revoked = {};
    await updateIndex(store, userId, (tokens) => {
        revoked = tokens;
        return {};
    });
    for (const [id, token] of Object.entries(revoked)) {
        await nullIfMissing(() => store.remove(tokenKey(token.hash)));
        lookupCache.delete(token.hash);
        signInEvents.emit("ended", tokenSessionId(id));
    }
    return Object.keys(revoked).length;
};

export const isPersonalToken = (token) => typeof token === "string" && token.startsWith(TOKEN_PREFIX);

// The caller a personal token stands for, or null when it is unknown, expired, revoked or switched off.
export const resolvePersonalToken = async (token, { store = defaultStore() } = {}) => {
    if (!personalTokensAllowed() || token.length > 120) return null;
    const hash = hashOf(token);
    const cached = lookupCache.get(hash);
    let record = cached && Date.now() - cached.at < LOOKUP_CACHE_MS ? cached.record : undefined;
    if (record === undefined) {
        record = (await nullIfMissing(() => store.get(tokenKey(hash))))?.content ?? null;
        if (lookupCache.size > 10_000) lookupCache.clear();
        lookupCache.set(hash, { record, at: Date.now() });
    }
    if (!record || record.expiresAt <= Date.now()) return null;
    if (!record.lastUsedAt || Date.now() - record.lastUsedAt > LAST_USED_RESOLUTION_MS) {
        record.lastUsedAt = Date.now();
        const noteFailure = (error) => logger.warn({ err: error, tokenId: record.id }, "couldn't record a personal token's last use");
        // Replace, never upsert: a revoke that lands meanwhile must not be undone by this write.
        nullIfMissing(() => store.replace(tokenKey(hash), record, { expiry: secondsUntil(record.expiresAt) })).catch(noteFailure);
        updateIndex(store, record.userId, (tokens) =>
            tokens[record.id] ? { ...tokens, [record.id]: { ...tokens[record.id], lastUsedAt: record.lastUsedAt } } : tokens,
        ).catch(noteFailure);
    }
    return { userId: record.userId, sid: tokenSessionId(record.id), scope: record.scope, boards: record.boards, agent: record.name };
};
