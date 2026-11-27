import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// The user models connect to Couchbase on import, so they're mocked.
vi.mock("../../../models/userSchema.js", () => ({
    default: {
        findById: vi.fn(),
        findOne: vi.fn(),
        create: vi.fn(),
        removeById: vi.fn(),
        register: vi.fn(),
        hashPassword: vi.fn(async (password) => `hashed:${password}`),
    },
}));
vi.mock("../../../models/usernameSchema.js", () => ({ default: {} }));
vi.mock("../../../models/refreshTokenSchema.js", () => ({ default: {} }));

const usernameCollection = {
    insert: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
};
const missing = () => Object.assign(new Error("not found"), { name: "DocumentNotFoundError" });
// The session store's KV calls, kept in memory so sign-ins can start and end for real.
const sessionDocs = new Map();
const refreshTokenCollection = {
    get: vi.fn(async (key) => {
        if (!sessionDocs.has(key)) throw missing();
        return { content: structuredClone(sessionDocs.get(key)), cas: 1 };
    }),
    insert: vi.fn(async (key, content) => sessionDocs.set(key, structuredClone(content))),
    upsert: vi.fn(async (key, content) => sessionDocs.set(key, structuredClone(content))),
    replace: vi.fn(async (key, content) => sessionDocs.set(key, structuredClone(content))),
    remove: vi.fn(async (key) => {
        if (!sessionDocs.delete(key)) throw missing();
    }),
};
const userQuery = vi.fn();
vi.mock("ottoman", () => ({
    getCollection: vi.fn((name) => (name === "refreshTokens" ? refreshTokenCollection : usernameCollection)),
    getDefaultInstance: () => ({ query: userQuery }),
}));

const User = (await import("../../../models/userSchema.js")).default;
const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { registerSchema, loginSchema, changePasswordSchema, updateThemeSchema } = await import("../../../validation/restSchemas.js");
const { register, login, oauthLogin, oauthComplete, changePassword, updateTheme, getMe } = await import("../authController.js");
const { oauthLoginSchema, oauthCompleteSchema } = await import("../../../validation/restSchemas.js");
const { startSession, refreshSession } = await import("../../../auth/sessionTokens.js");
const { createPersonalToken, resolvePersonalToken } = await import("../../../auth/personalTokens.js");

// Mirrors the real route wiring (authRoutes.js).
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/api/auth/register", validateBody(registerSchema), register);
    app.post("/api/auth/login", validateBody(loginSchema), login);
    app.post("/api/auth/oauth-login", validateBody(oauthLoginSchema), oauthLogin);
    app.post("/api/auth/oauth-complete", validateBody(oauthCompleteSchema), oauthComplete);
    app.put("/api/auth/password", authCheck, validateBody(changePasswordSchema), changePassword);
    app.put("/api/auth/theme", authCheck, validateBody(updateThemeSchema), updateTheme);
    app.get("/api/auth/me", authCheck, getMe);
    return app;
};

const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);

const buildFakeUser = (overrides = {}) => ({
    _id: "user-1",
    username: "ada",
    password: "old-hash",
    comparePassword: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
});

class FakeDocumentExistsError extends Error {}
Object.defineProperty(FakeDocumentExistsError.prototype.constructor, "name", { value: "DocumentExistsError" });

beforeEach(() => {
    vi.clearAllMocks();
    sessionDocs.clear();
    usernameCollection.get.mockRejectedValue(missing());
    userQuery.mockResolvedValue({ rows: [] });
});

describe("POST /api/auth/register", () => {
    it("reserves the username and returns a token on success", async () => {
        const fakeUser = buildFakeUser();
        User.register.mockResolvedValue(fakeUser);
        usernameCollection.insert.mockResolvedValue(undefined);

        const res = await request(buildApp()).post("/api/auth/register").send({ username: "ada", password: "harbor-lights-42" });

        expect(res.status).toBe(200);
        expect(User.register).toHaveBeenCalledWith("ada", "harbor-lights-42");
        expect(usernameCollection.insert).toHaveBeenCalledWith("ada", { userId: "user-1" });
        expect(res.body.user).toBeTruthy();
        expect(res.body.token).toBeTruthy();
        expect(res.body.refreshToken).toEqual(expect.any(String));
        expect(res.body.accessTokenExpiresAt).toBeGreaterThan(Date.now());
    });

    it("rolls back the user and returns 409 with suggestions when someone reserves the name first", async () => {
        const fakeUser = buildFakeUser();
        User.register.mockResolvedValue(fakeUser);
        const exists = new FakeDocumentExistsError("exists");
        exists.constructor = { name: "DocumentExistsError" };
        usernameCollection.insert.mockRejectedValue(exists);

        const res = await request(buildApp()).post("/api/auth/register").send({ username: "ada", password: "harbor-lights-42" });

        expect(res.status).toBe(409);
        expect(User.removeById).toHaveBeenCalledWith("user-1");
        expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it("refuses a name that differs from an existing one only in case, before creating anyone", async () => {
        userQuery.mockImplementation(async (sql, { parameters }) => ({ rows: parameters.name === "ada" ? [1] : [] }));

        const res = await request(buildApp()).post("/api/auth/register").send({ username: "Ada", password: "harbor-lights-42" });

        expect(res.status).toBe(409);
        expect(User.register).not.toHaveBeenCalled();
        expect(res.body.suggestions.every((name) => name.toLowerCase() !== "ada")).toBe(true);
    });

    it("reserves names without regard to case", async () => {
        User.register.mockResolvedValue(buildFakeUser({ username: "Grace" }));
        usernameCollection.insert.mockResolvedValue(undefined);

        await request(buildApp()).post("/api/auth/register").send({ username: "Grace", password: "harbor-lights-42" });

        expect(usernameCollection.insert).toHaveBeenCalledWith("grace", { userId: "user-1" });
    });

    it("rejects an invalid payload before touching the DB", async () => {
        const res = await request(buildApp()).post("/api/auth/register").send({ username: "a", password: "hunter2" });

        expect(res.status).toBe(400);
        expect(User.register).not.toHaveBeenCalled();
    });
});

describe("POST /api/auth/login", () => {
    it("logs in with a correct username/password", async () => {
        const fakeUser = buildFakeUser();
        User.findOne.mockResolvedValue(fakeUser);

        const res = await request(buildApp()).post("/api/auth/login").send({ username: "ada", password: "hunter2" });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });

    it("rejects a wrong password", async () => {
        const fakeUser = buildFakeUser({ comparePassword: vi.fn().mockResolvedValue(false) });
        User.findOne.mockResolvedValue(fakeUser);

        const res = await request(buildApp()).post("/api/auth/login").send({ username: "ada", password: "wrong" });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("wrong_credentials");
    });

    it("returns 400 for a username that doesn't exist", async () => {
        User.findOne.mockRejectedValue(Object.assign(new Error("not found"), { name: "DocumentNotFoundError" }));

        const res = await request(buildApp()).post("/api/auth/login").send({ username: "nobody", password: "hunter2" });

        // The same answer as a wrong password, so the form can't be used to find accounts.
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("wrong_credentials");
    });

    it("refuses a password for an account that only signs in with Google or GitHub", async () => {
        User.findOne.mockResolvedValue(buildFakeUser({ password: undefined }));
        const res = await request(buildApp()).post("/api/auth/login").send({ username: "ada", password: "anything" });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("wrong_credentials");
    });
});

describe("PUT /api/auth/password", () => {
    it("rejects an unauthenticated request before touching the DB", async () => {
        const res = await request(buildApp()).put("/api/auth/password").send({ oldpassword: "old", password: "harbor-lights-42" });

        expect(res.status).toBe(401);
        expect(User.findById).not.toHaveBeenCalled();
    });

    it("hashes and saves the new password when the old one checks out", async () => {
        const fakeUser = buildFakeUser();
        User.findById.mockResolvedValue(fakeUser);

        const res = await request(buildApp())
            .put("/api/auth/password")
            .set("Authorization", `Bearer ${token}`)
            .send({ oldpassword: "old", password: "harbor-lights-42" });

        expect(res.status).toBe(200);
        expect(fakeUser.comparePassword).toHaveBeenCalledWith("old");
        expect(User.hashPassword).toHaveBeenCalledWith("harbor-lights-42");
        expect(fakeUser.password).toBe("hashed:harbor-lights-42");
        expect(fakeUser.save).toHaveBeenCalledTimes(1);
    });

    it("ends the account's other sign-ins and keeps the one that changed it", async () => {
        User.findById.mockResolvedValue(buildFakeUser());
        const here = await startSession("user-1");
        const elsewhere = await startSession("user-1");

        const res = await request(buildApp())
            .put("/api/auth/password")
            .set("Authorization", `Bearer ${here.token}`)
            .send({ oldpassword: "old", password: "harbor-lights-42" });

        expect(res.status).toBe(200);
        expect(res.body.endedSessions).toBe(1);
        expect(await refreshSession(elsewhere.refreshToken)).toBeNull();
        const staleAccess = await request(buildApp()).get("/api/auth/me").set("Authorization", `Bearer ${elsewhere.token}`);
        expect(staleAccess.status).toBe(401);
        expect(await refreshSession(here.refreshToken)).not.toBeNull();
    });

    it("revokes every personal token the account holds", async () => {
        User.findById.mockResolvedValue(buildFakeUser());
        const here = await startSession("user-1");
        const made = await createPersonalToken("user-1", { name: "CI", scope: "write" });

        const res = await request(buildApp())
            .put("/api/auth/password")
            .set("Authorization", `Bearer ${here.token}`)
            .send({ oldpassword: "old", password: "harbor-lights-42" });

        expect(res.status).toBe(200);
        expect(res.body.revokedTokens).toBe(1);
        expect(await resolvePersonalToken(made.token)).toBeNull();
    });

    it("explains that an account without a password has none to change", async () => {
        User.findById.mockResolvedValue(buildFakeUser({ password: undefined }));
        const res = await request(buildApp())
            .put("/api/auth/password")
            .set("Authorization", `Bearer ${token}`)
            .send({ oldpassword: "anything", password: "harbor-lights-42" });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("no_password");
    });

    it("rejects a wrong old password without saving anything", async () => {
        const fakeUser = buildFakeUser({ comparePassword: vi.fn().mockResolvedValue(false) });
        User.findById.mockResolvedValue(fakeUser);

        const res = await request(buildApp())
            .put("/api/auth/password")
            .set("Authorization", `Bearer ${token}`)
            .send({ oldpassword: "wrong", password: "newpass1" });

        expect(res.status).toBe(400);
        expect(User.hashPassword).not.toHaveBeenCalled();
        expect(fakeUser.save).not.toHaveBeenCalled();
    });
});

describe("social sign-in", () => {
    const github = { provider: "github", providerAccountId: "gh-42", email: "ada@example.com", name: "Ada" };

    it("signs in the account that owns this provider identity", async () => {
        User.findOne.mockImplementation(async (query) => (query.oauthId === "gh-42" ? buildFakeUser({ oauthProvider: "github", oauthId: "gh-42" }) : null));
        const res = await request(buildApp())
            .post("/api/auth/oauth-login")
            .send({ ...github, emailVerified: true });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });

    it("never signs in someone else's account because a provider claims their email", async () => {
        User.findOne.mockImplementation(async (query) => (query.email ? buildFakeUser({ username: "victim", oauthProvider: "google", oauthId: "g-1" }) : null));
        const unverified = await request(buildApp())
            .post("/api/auth/oauth-login")
            .send({ ...github, emailVerified: false });
        expect(unverified.body.needsUsername).toBe(true);
        expect(unverified.body.draft.email).toBeNull();
        const verified = await request(buildApp())
            .post("/api/auth/oauth-login")
            .send({ ...github, emailVerified: true });
        expect(verified.status).toBe(409);
        expect(verified.body.code).toBe("email_in_use");
        expect(verified.body.token).toBeUndefined();
    });

    it("links an older account made through the same provider by its verified email", async () => {
        const legacy = buildFakeUser({ oauthProvider: "github", oauthId: undefined, email: "ada@example.com" });
        User.findOne.mockImplementation(async (query) => (query.email ? legacy : null));
        const res = await request(buildApp())
            .post("/api/auth/oauth-login")
            .send({ ...github, emailVerified: true });
        expect(res.status).toBe(200);
        expect(legacy.oauthId).toBe("gh-42");
        expect(legacy.save).toHaveBeenCalled();
    });

    it("refuses to finish a sign-up into an email another account owns", async () => {
        User.findOne.mockImplementation(async (query) => (query.email ? buildFakeUser({ username: "victim" }) : null));
        const res = await request(buildApp())
            .post("/api/auth/oauth-complete")
            .send({ ...github, emailVerified: true, username: "mallory" });
        expect(res.status).toBe(409);
        expect(User.create).not.toHaveBeenCalled();
    });

    it("keeps an unverified email off the new account", async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue(buildFakeUser({ _id: "new-user" }));
        usernameCollection.insert.mockResolvedValue(undefined);
        const res = await request(buildApp())
            .post("/api/auth/oauth-complete")
            .send({ ...github, emailVerified: false, username: "ada_gh" });
        expect(res.status).toBe(200);
        expect(User.create).toHaveBeenCalledWith({ username: "ada_gh", oauthProvider: "github", oauthId: "gh-42" });
    });

    it("refuses a provider it does not support", async () => {
        const res = await request(buildApp())
            .post("/api/auth/oauth-login")
            .send({ ...github, provider: "myspace" });
        expect(res.status).toBe(400);
    });
});

describe("PUT /api/auth/theme", () => {
    it("saves the theme preference on the JWT's own user", async () => {
        const fakeUser = buildFakeUser();
        User.findById.mockResolvedValue(fakeUser);

        const res = await request(buildApp()).put("/api/auth/theme").set("Authorization", `Bearer ${token}`).send({ theme: "dark" });

        expect(res.status).toBe(200);
        expect(fakeUser.themePreference).toBe("dark");
        expect(fakeUser.save).toHaveBeenCalledTimes(1);
    });

    it("rejects a theme outside the known enum", async () => {
        const res = await request(buildApp()).put("/api/auth/theme").set("Authorization", `Bearer ${token}`).send({ theme: "cyberpunk" });

        expect(res.status).toBe(400);
    });
});

describe("GET /api/auth/me", () => {
    it("returns the JWT user's own username, join date, whether a password is set and how many recovery codes are left, never a hash", async () => {
        User.findById.mockResolvedValue(buildFakeUser({ createdAt: "2026-08-02T10:00:00.000Z", recoveryCodes: ["hash-a", "hash-b"] }));

        const res = await request(buildApp()).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({
            username: "ada",
            createdAt: "2026-08-02T10:00:00.000Z",
            hasPassword: true,
            recoveryCodesLeft: 2,
            themePreference: null,
        });
        expect(User.findById).toHaveBeenCalledWith("user-1");
    });

    it("reports an OAuth-only account as having no password", async () => {
        User.findById.mockResolvedValue(buildFakeUser({ password: undefined }));

        const res = await request(buildApp()).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

        expect(res.body.data.hasPassword).toBe(false);
    });
});
