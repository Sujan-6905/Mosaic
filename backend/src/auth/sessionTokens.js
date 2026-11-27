// A short-lived JWT naming its sign-in plus a hashed, single-use refresh token. A refresh
// token reused after the grace window means a copy exists, so the sign-in ends.
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import jwt from "jsonwebtoken";
import { getCollection } from "ottoman";
import { isCasMismatch, isDocumentExists, nullIfMissing } from "../db/errors.js";

export const ACCESS_TOKEN_SECONDS = 15 * 60;
// Unused this long and a refresh token lapses; used, it is replaced with a fresh one.
export const REFRESH_IDLE_SECONDS = 14 * 24 * 60 * 60;
// However often it is refreshed, a sign-in ends this long after it began.
export const SIGN_IN_MAX_SECONDS = 30 * 24 * 60 * 60;
// Two tabs refreshing at once both present the same token; both get the same
// successor, so a copy used inside this window gains no sign-in of its own.
const ROTATION_GRACE_MS = 30 * 1000;
// How long a server trusts its last answer about whether a sign-in is still on.
const LIVENESS_CACHE_MS = 10 * 1000;
const LIVENESS_CACHE_LIMIT = 50_000;
export const JWT_ALGORITHM = "HS256";

const COLLECTION = "refreshTokens";
const SCOPE = "app";
const defaultStore = () => getCollection(COLLECTION, SCOPE);

const hashOf = (token) => crypto.createHash("sha256").update(token).digest("hex");
const tokenKey = (hash) => `token::${hash}`;
const familyKey = (familyId) => `family::${familyId}`;
const userKey = (userId) => `user::${userId}`;
const secondsUntil = (time) => Math.max(1, Math.ceil((time - Date.now()) / 1000));

// The id keeps two tokens minted in the same second distinct, so a renewed token never equals the one it replaces.
const signAccessToken = (userId, sid, grant = {}) =>
    jwt.sign({ userId, sid, ...grant }, process.env.JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_SECONDS, jwtid: crypto.randomUUID() });

// The successor is sealed with a key only a holder of the old token can derive.
const sealKey = (refreshToken) => crypto.createHash("sha256").update(`successor:${refreshToken}`).digest();
const sealSuccessor = (successor, refreshToken) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", sealKey(refreshToken), iv);
    const sealed = Buffer.concat([cipher.update(successor, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64url");
};
const openSuccessor = (sealed, refreshToken) => {
    const raw = Buffer.from(sealed, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", sealKey(refreshToken), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
};

const newRefreshToken = () => crypto.randomBytes(32).toString("base64url");

const storeRefreshToken = async (store, refreshToken, { userId, familyId, familyExpiresAt }) => {
    const expiresAt = Math.min(Date.now() + REFRESH_IDLE_SECONDS * 1000, familyExpiresAt);
    await store.insert(tokenKey(hashOf(refreshToken)), { userId, familyId, expiresAt, usedAt: null }, { expiry: secondsUntil(expiresAt) });
    return refreshToken;
};

const pairFor = (family, familyId, refreshToken) => ({
    token: signAccessToken(family.userId, familyId, family.grant || {}),
    refreshToken,
    accessTokenExpiresAt: Date.now() + ACCESS_TOKEN_SECONDS * 1000,
});

// Read-modify-write of one document under CAS, retried when another writer got there first.
const updateWithCas = async (store, key, change, { expiry }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const found = await nullIfMissing(() => store.get(key));
        const next = change(found?.content ?? null);
        try {
            if (found) await store.replace(key, next, { cas: found.cas, expiry });
            else await store.insert(key, next, { expiry });
            return;
        } catch (error) {
            if (!isCasMismatch(error) && !isDocumentExists(error)) throw error;
        }
    }
    throw new Error(`gave up updating ${key} after repeated concurrent writes`);
};

const liveFamilies = (families) => Object.fromEntries(Object.entries(families || {}).filter(([, expiresAt]) => expiresAt > Date.now()));

// Every sign-in a person has, so a password change can end them all.
const indexFamily = (store, userId, familyId, expiresAt) =>
    updateWithCas(store, userKey(userId), (index) => ({ families: { ...liveFamilies(index?.families), [familyId]: expiresAt } }), {
        expiry: SIGN_IN_MAX_SECONDS,
    });

const unindexFamily = (store, userId, familyId) =>
    updateWithCas(
        store,
        userKey(userId),
        (index) => {
            const families = liveFamilies(index?.families);
            delete families[familyId];
            return { families };
        },
        { expiry: SIGN_IN_MAX_SECONDS },
    );

// A new sign-in: its own family, so ending it never touches the person's other devices.
// A grant (an agent's OAuth access) rides in every access token the sign-in issues.
export const startSession = async (userId, { store = defaultStore(), grant = null } = {}) => {
    const familyId = crypto.randomUUID();
    const familyExpiresAt = Date.now() + SIGN_IN_MAX_SECONDS * 1000;
    const family = { userId, expiresAt: familyExpiresAt, revokedAt: null, startedAt: Date.now(), ...(grant ? { grant } : {}) };
    await store.insert(familyKey(familyId), family, { expiry: SIGN_IN_MAX_SECONDS });
    await indexFamily(store, userId, familyId, familyExpiresAt);
    return pairFor(family, familyId, await storeRefreshToken(store, newRefreshToken(), { userId, familyId, familyExpiresAt }));
};

// Emits "ended" with a sign-in's id, so live connections made with it can be closed.
export const signInEvents = new EventEmitter();

const livenessCache = new Map();

const rememberLiveness = (familyId, live) => {
    if (livenessCache.size >= LIVENESS_CACHE_LIMIT) livenessCache.clear();
    livenessCache.set(familyId, { live, checkedAt: Date.now() });
};

const endFamily = async (store, familyId) => {
    const family = await nullIfMissing(() => store.get(familyKey(familyId)));
    rememberLiveness(familyId, false);
    if (!family) return null;
    if (!family.content.revokedAt) {
        await store.upsert(familyKey(familyId), { ...family.content, revokedAt: Date.now() }, { expiry: secondsUntil(family.content.expiresAt) });
    }
    await unindexFamily(store, family.content.userId, familyId);
    signInEvents.emit("ended", familyId);
    return familyId;
};

// Whether an access token's sign-in is still on; answered from a short cache so
// a busy socket or API path costs one read per sign-in every few seconds.
export const isSignInLive = async (familyId, { store = defaultStore() } = {}) => {
    const cached = livenessCache.get(familyId);
    if (cached && Date.now() - cached.checkedAt < LIVENESS_CACHE_MS) return cached.live;
    const family = await nullIfMissing(() => store.get(familyKey(familyId)));
    const live = !!family && !family.content.revokedAt && family.content.expiresAt > Date.now();
    rememberLiveness(familyId, live);
    return live;
};

// Null when the sign-in is over. With `clientId`, the sign-in must belong to that OAuth app.
export const refreshSession = async (refreshToken, { store = defaultStore(), clientId } = {}) => {
    if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 200) return null;
    const key = tokenKey(hashOf(refreshToken));
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const found = await nullIfMissing(() => store.get(key));
        if (!found || found.content.expiresAt <= Date.now()) return null;
        const { userId, familyId, usedAt } = found.content;
        const family = await nullIfMissing(() => store.get(familyKey(familyId)));
        if (!family || family.content.revokedAt || family.content.expiresAt <= Date.now()) return null;
        if (clientId !== undefined && family.content.grant?.clientId !== clientId) return null;
        if (usedAt) {
            if (Date.now() - usedAt <= ROTATION_GRACE_MS && found.content.successor) {
                return pairFor(family.content, familyId, openSuccessor(found.content.successor, refreshToken));
            }
            await endFamily(store, familyId);
            return null;
        }
        const successor = newRefreshToken();
        try {
            await store.replace(
                key,
                { ...found.content, usedAt: Date.now(), successor: sealSuccessor(successor, refreshToken) },
                { cas: found.cas, expiry: secondsUntil(found.content.expiresAt) },
            );
        } catch (error) {
            // Another request used it between the read and the write: read again and judge it as used.
            if (isCasMismatch(error)) continue;
            throw error;
        }
        await storeRefreshToken(store, successor, { userId, familyId, familyExpiresAt: family.content.expiresAt });
        return pairFor(family.content, familyId, successor);
    }
    return null;
};

// Signing out ends the sign-in this refresh token belongs to.
export const endSession = async (refreshToken, { store = defaultStore() } = {}) => {
    if (typeof refreshToken !== "string" || refreshToken.length > 200) return;
    const found = await nullIfMissing(() => store.get(tokenKey(hashOf(refreshToken))));
    if (found) await endFamily(store, found.content.familyId);
};

export const endSessionById = (familyId, { store = defaultStore() } = {}) => endFamily(store, familyId);

// Ends every sign-in the person has except the one named; returns the ids it ended.
export const endOtherSessions = async (userId, { except = null, store = defaultStore() } = {}) => {
    const index = await nullIfMissing(() => store.get(userKey(userId)));
    const ended = [];
    for (const familyId of Object.keys(liveFamilies(index?.content.families))) {
        if (familyId === except) continue;
        ended.push(await endFamily(store, familyId));
    }
    return ended.filter(Boolean);
};

// The person's sign-ins that carry an agent grant, for the connected-agents list.
export const listGrants = async (userId, { store = defaultStore() } = {}) => {
    const index = await nullIfMissing(() => store.get(userKey(userId)));
    const grants = [];
    for (const familyId of Object.keys(liveFamilies(index?.content.families))) {
        const family = await nullIfMissing(() => store.get(familyKey(familyId)));
        if (family?.content.grant?.kind === "oauth" && !family.content.revokedAt)
            grants.push({ id: familyId, startedAt: family.content.startedAt, ...family.content.grant });
    }
    return grants;
};

export const ownerOfSession = async (familyId, { store = defaultStore() } = {}) => {
    const family = await nullIfMissing(() => store.get(familyKey(familyId)));
    return family?.content.userId ?? null;
};
