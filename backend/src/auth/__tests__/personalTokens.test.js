import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeKvCollection } from "../../../test/fakeKvCollection.js";

vi.mock("ottoman", () => ({ getCollection: vi.fn() }));
const { createPersonalToken, resolvePersonalToken, revokePersonalToken, revokeAllPersonalTokens, listPersonalTokens, MAX_TOKEN_DAYS, MAX_TOKENS_PER_PERSON } =
    await import("../personalTokens.js");
const { signInEvents } = await import("../sessionTokens.js");

let store;
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T09:00:00Z"));
    store = fakeKvCollection();
});
afterEach(() => {
    vi.useRealTimers();
    delete process.env.PERSONAL_TOKENS_DISABLED;
});

describe("personal access tokens", () => {
    it("returns the token once and keeps only its hash", async () => {
        const created = await createPersonalToken("u1", { name: "CI", scope: "read" }, { store });
        expect(created.token).toMatch(/^mosaic_pat_/);
        expect([...store.docs.keys()].some((key) => key.includes(created.token))).toBe(false);
        expect(JSON.stringify([...store.docs.values()])).not.toContain(created.token);
        expect((await listPersonalTokens("u1", { store }))[0]).not.toHaveProperty("token");
    });

    it("stands for its person as an agent, with its scope and boards", async () => {
        const { token, id } = await createPersonalToken("u1", { name: "Cursor", scope: "write", boards: ["b1"] }, { store });
        expect(await resolvePersonalToken(token, { store })).toEqual({ userId: "u1", sid: `pat:${id}`, scope: "write", boards: ["b1"], agent: "Cursor" });
    });

    it("stops working at its expiry, which is never more than a year", async () => {
        const { token, expiresAt } = await createPersonalToken("u1", { name: "x", scope: "read", days: 5000 }, { store });
        expect(expiresAt - Date.now()).toBe(MAX_TOKEN_DAYS * 24 * 60 * 60 * 1000);
        vi.advanceTimersByTime(MAX_TOKEN_DAYS * 24 * 60 * 60 * 1000 + 1000);
        expect(await resolvePersonalToken(token, { store })).toBeNull();
    });

    it("stops working the moment it is revoked, and closes its connections", async () => {
        const { token, id } = await createPersonalToken("u1", { name: "x", scope: "read" }, { store });
        await resolvePersonalToken(token, { store });
        const ended = vi.fn();
        signInEvents.on("ended", ended);
        expect(await revokePersonalToken("u1", id, { store })).toBe(true);
        signInEvents.off("ended", ended);
        expect(ended).toHaveBeenCalledWith(`pat:${id}`);
        expect(await resolvePersonalToken(token, { store })).toBeNull();
    });

    it("stays revoked when the revoke lands while its last use is being recorded", async () => {
        const { token, id } = await createPersonalToken("u1", { name: "x", scope: "read" }, { store });
        const read = store.get.bind(store);
        store.get = async (key) => {
            const found = await read(key);
            store.get = read;
            await revokePersonalToken("u1", id, { store });
            return found;
        };
        await resolvePersonalToken(token, { store });
        await vi.runAllTimersAsync();
        expect([...store.docs.values()].some(({ content }) => content.id === id)).toBe(false);
    });

    it("ends every one of a person's tokens at once, and nobody else's", async () => {
        const first = await createPersonalToken("u1", { name: "a", scope: "read" }, { store });
        const second = await createPersonalToken("u1", { name: "b", scope: "write" }, { store });
        const other = await createPersonalToken("u2", { name: "c", scope: "read" }, { store });
        const ended = vi.fn();
        signInEvents.on("ended", ended);
        expect(await revokeAllPersonalTokens("u1", { store })).toBe(2);
        signInEvents.off("ended", ended);
        expect(ended.mock.calls.map(([sid]) => sid).sort()).toEqual([`pat:${first.id}`, `pat:${second.id}`].sort());
        expect(await resolvePersonalToken(first.token, { store })).toBeNull();
        expect(await resolvePersonalToken(second.token, { store })).toBeNull();
        expect(await listPersonalTokens("u1", { store })).toEqual([]);
        expect(await resolvePersonalToken(other.token, { store })).not.toBeNull();
    });

    it("never leaves a working token off the person's list, even when a revoke-all lands while it is being made", async () => {
        const insert = store.insert.bind(store);
        store.insert = async (key, content, options) => {
            await insert(key, content, options);
            if (key.startsWith("pat::")) {
                store.insert = insert;
                await revokeAllPersonalTokens("u1", { store });
            }
        };
        const made = await createPersonalToken("u1", { name: "racing", scope: "read" }, { store });
        const works = (await resolvePersonalToken(made.token, { store })) !== null;
        const listed = (await listPersonalTokens("u1", { store })).some((token) => token.id === made.id);
        expect(works).toBe(listed);
    });

    it("refuses a token past the limit without leaving it usable", async () => {
        for (let i = 0; i < MAX_TOKENS_PER_PERSON; i += 1) await createPersonalToken("u1", { name: `t${i}`, scope: "read" }, { store });
        const before = store.docs.size;
        expect(await createPersonalToken("u1", { name: "one too many", scope: "read" }, { store })).toHaveProperty("error");
        expect(store.docs.size).toBe(before);
    });

    it("can't be revoked by someone else", async () => {
        const { id } = await createPersonalToken("u1", { name: "x", scope: "read" }, { store });
        expect(await revokePersonalToken("u2", id, { store })).toBe(false);
    });

    it("works nowhere when the server switches tokens off", async () => {
        const { token } = await createPersonalToken("u1", { name: "x", scope: "read" }, { store });
        process.env.PERSONAL_TOKENS_DISABLED = "true";
        expect(await resolvePersonalToken(token, { store })).toBeNull();
    });
});
