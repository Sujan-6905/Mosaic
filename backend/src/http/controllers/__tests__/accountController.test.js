import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const users = new Map();
const fakeUser = (fields) => ({
    ...fields,
    comparePassword: vi.fn(async (password) => password === "right-password"),
    save: vi.fn(async function save() {
        users.set(this._id, this);
    }),
});
vi.mock("../../../models/userSchema.js", () => ({
    default: {
        findById: vi.fn(async (id) => users.get(id) ?? null),
        findOne: vi.fn(async ({ username }) => [...users.values()].find((user) => user.username === username) ?? null),
        hashPassword: vi.fn(async (password) => `hashed:${password}`),
        removeById: vi.fn(async (id) => users.delete(id)),
    },
}));
const drawingFind = vi.fn();
const writeFields = vi.fn();
vi.mock("../../../models/drawingSchema.js", () => ({ default: { find: (...args) => drawingFind(...args), writeFields: (...args) => writeFields(...args) } }));
const removeBoard = vi.fn();
const findDrawingsSharedWithUser = vi.fn();
vi.mock("../../../services/boards.js", () => ({
    removeBoard: (...args) => removeBoard(...args),
    findDrawingsSharedWithUser: (...args) => findDrawingsSharedWithUser(...args),
}));
const enforceLiveAccess = vi.fn();
vi.mock("../../../services/liveAccess.js", () => ({ enforceLiveAccess: (...args) => enforceLiveAccess(...args) }));
const endOtherSessions = vi.fn().mockResolvedValue([]);
vi.mock("../../../auth/sessionTokens.js", async (importOriginal) => ({
    ...(await importOriginal()),
    endOtherSessions: (...args) => endOtherSessions(...args),
}));
const revokeAllPersonalTokens = vi.fn().mockResolvedValue(0);
vi.mock("../../../auth/personalTokens.js", async (importOriginal) => ({
    ...(await importOriginal()),
    revokeAllPersonalTokens: (...args) => revokeAllPersonalTokens(...args),
}));
const query = vi.fn().mockResolvedValue({ rows: [] });
const reservations = new Map();
vi.mock("ottoman", () => ({
    getDefaultInstance: () => ({ query: (...args) => query(...args) }),
    getCollection: () => ({
        get: vi.fn(async (key) => {
            if (!reservations.has(key)) throw Object.assign(new Error("missing"), { name: "DocumentNotFoundError" });
            return { content: reservations.get(key) };
        }),
        remove: vi.fn(async (key) => reservations.delete(key)),
    }),
}));

const authCheck = (await import("../../middlewares/authMiddleware.js")).default;
const validateBody = (await import("../../middlewares/validateBody.js")).default;
const { recoveryCodesSchema, recoverAccountSchema, deleteAccountSchema } = await import("../../../validation/restSchemas.js");
const { createRecoveryCodes, recoverAccount, deleteAccount } = await import("../accountController.js");

const app = express();
app.use(express.json());
app.post("/recovery-codes", authCheck, validateBody(recoveryCodesSchema), createRecoveryCodes);
app.post("/recover", validateBody(recoverAccountSchema), recoverAccount);
app.delete("/account", authCheck, validateBody(deleteAccountSchema), deleteAccount);
const token = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET);

beforeEach(() => {
    vi.clearAllMocks();
    users.clear();
    reservations.clear();
    users.set("u1", fakeUser({ _id: "u1", username: "ava", password: "hashed:old", recoveryCodes: [] }));
});

const makeCodes = async () =>
    (await request(app).post("/recovery-codes").set("Authorization", `Bearer ${token}`).send({ password: "right-password" })).body.codes;

describe("recovery codes", () => {
    it("are made only after the password is confirmed, shown once and stored only as hashes", async () => {
        expect((await request(app).post("/recovery-codes").set("Authorization", `Bearer ${token}`).send({ password: "wrong" })).status).toBe(400);
        const codes = await makeCodes();
        expect(codes).toHaveLength(10);
        expect(new Set(codes).size).toBe(10);
        expect(JSON.stringify(users.get("u1").recoveryCodes)).not.toContain(codes[0]);
    });

    it("replace a forgotten password once each, ending every sign-in and token", async () => {
        const [code] = await makeCodes();
        const recovered = await request(app).post("/recover").send({ username: "ava", code: code.toUpperCase(), password: "harbor-lights-42" });
        expect(recovered.status).toBe(200);
        expect(recovered.body.recoveryCodesLeft).toBe(9);
        expect(users.get("u1").password).toBe("hashed:harbor-lights-42");
        expect(endOtherSessions).toHaveBeenCalledWith("u1");
        expect(revokeAllPersonalTokens).toHaveBeenCalledWith("u1");

        const reused = await request(app).post("/recover").send({ username: "ava", code, password: "another-pass-77" });
        expect(reused.status).toBe(400);
        expect(reused.body.message).toBe("That username and recovery code don't match.");
    });

    it("refuse an unknown name and a wrong code the same way", async () => {
        await makeCodes();
        const unknown = await request(app).post("/recover").send({ username: "nobody", code: "aaaa-bbbb-cccc-dddd", password: "harbor-lights-42" });
        const wrong = await request(app).post("/recover").send({ username: "ava", code: "aaaa-bbbb-cccc-dddd", password: "harbor-lights-42" });
        expect(unknown.body).toEqual(wrong.body);
        expect(users.get("u1").password).toBe("hashed:old");
    });
});

describe("deleting an account", () => {
    it("needs the username typed exactly and the password", async () => {
        expect(
            (await request(app).delete("/account").set("Authorization", `Bearer ${token}`).send({ username: "Ava", password: "right-password" })).status,
        ).toBe(400);
        expect((await request(app).delete("/account").set("Authorization", `Bearer ${token}`).send({ username: "ava", password: "wrong" })).status).toBe(400);
        expect(users.has("u1")).toBe(true);
    });

    it("removes its boards, its place on other boards, its own rows, its credentials and its name", async () => {
        drawingFind.mockResolvedValue({ rows: [{ _id: "d1", shareId: "mine" }] });
        findDrawingsSharedWithUser.mockResolvedValue([
            {
                _id: "d2",
                shareId: "theirs",
                collaborators: [
                    { userId: "u1", role: "editor" },
                    { userId: "u2", role: "viewer" },
                ],
            },
        ]);
        reservations.set("ava", { userId: "u1" });

        const res = await request(app).delete("/account").set("Authorization", `Bearer ${token}`).send({ username: "ava", password: "right-password" });

        expect(res.status).toBe(204);
        expect(removeBoard).toHaveBeenCalledWith({ _id: "d1", shareId: "mine" });
        expect(writeFields).toHaveBeenCalledWith("d2", { collaborators: [{ userId: "u2", role: "viewer" }] });
        expect(enforceLiveAccess).toHaveBeenCalledWith(expect.objectContaining({ shareId: "theirs" }));
        const statements = query.mock.calls.map(([sql]) => sql).join("\n");
        ["notifications", "categories", "pieceSets", "aiConversations"].forEach((collection) => expect(statements).toContain(`\`${collection}\``));
        expect(revokeAllPersonalTokens).toHaveBeenCalledWith("u1");
        expect(endOtherSessions).toHaveBeenCalledWith("u1");
        expect(reservations.has("ava")).toBe(false);
        expect(users.has("u1")).toBe(false);
    });
});
