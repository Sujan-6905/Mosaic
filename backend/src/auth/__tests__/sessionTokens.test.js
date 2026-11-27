import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { fakeKvCollection } from "../../../test/fakeKvCollection.js";

vi.mock("ottoman", () => ({ getCollection: vi.fn() }));

const {
    startSession,
    refreshSession,
    endSession,
    endOtherSessions,
    isSignInLive,
    listGrants,
    signInEvents,
    ACCESS_TOKEN_SECONDS,
    REFRESH_IDLE_SECONDS,
    SIGN_IN_MAX_SECONDS,
} = await import("../sessionTokens.js");

const DAY = 24 * 60 * 60 * 1000;
let store;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T09:00:00Z"));
    store = fakeKvCollection();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("session tokens", () => {
    it("starts a sign-in with a 15 minute access token and a refresh token stored only as its hash", async () => {
        const pair = await startSession("user-1", { store });
        const claims = jwt.verify(pair.token, process.env.JWT_SECRET);
        expect(claims.userId).toBe("user-1");
        expect(claims.exp - claims.iat).toBe(ACCESS_TOKEN_SECONDS);
        expect(pair.accessTokenExpiresAt).toBe(Date.now() + ACCESS_TOKEN_SECONDS * 1000);
        expect([...store.docs.keys()].some((key) => key.includes(pair.refreshToken))).toBe(false);
    });

    it("keeps the bounds the sign-in promises: at least 7 days, never past 30", () => {
        expect(REFRESH_IDLE_SECONDS).toBeGreaterThanOrEqual(7 * 24 * 60 * 60);
        expect(SIGN_IN_MAX_SECONDS).toBeLessThanOrEqual(30 * 24 * 60 * 60);
    });

    it("swaps a refresh token for a new pair, once", async () => {
        const first = await startSession("user-1", { store });
        const second = await refreshSession(first.refreshToken, { store });
        expect(second.refreshToken).not.toBe(first.refreshToken);
        expect(second.token).not.toBe(first.token);
        expect(jwt.verify(second.token, process.env.JWT_SECRET).userId).toBe("user-1");
        expect(await refreshSession(second.refreshToken, { store })).not.toBeNull();
    });

    it("gives a second tab presenting the same token inside the grace window the same successor", async () => {
        const first = await startSession("user-1", { store });
        const tabA = await refreshSession(first.refreshToken, { store });
        vi.advanceTimersByTime(5000);
        const tabB = await refreshSession(first.refreshToken, { store });
        expect(tabB.refreshToken).toBe(tabA.refreshToken);
        expect(tabB.token).not.toBe(tabA.token);
    });

    it("leaves a copy used inside the grace window no sign-in of its own", async () => {
        const first = await startSession("user-1", { store });
        const owner = await refreshSession(first.refreshToken, { store });
        const thief = await refreshSession(first.refreshToken, { store });
        vi.advanceTimersByTime(60 * 1000);
        const ownerNext = await refreshSession(owner.refreshToken, { store });
        expect(ownerNext).not.toBeNull();
        vi.advanceTimersByTime(60 * 1000);
        expect(await refreshSession(thief.refreshToken, { store })).toBeNull();
        expect(await refreshSession(ownerNext.refreshToken, { store })).toBeNull();
    });

    it("ends the whole sign-in when a used token comes back later, as a stolen copy would", async () => {
        const first = await startSession("user-1", { store });
        const next = await refreshSession(first.refreshToken, { store });
        vi.advanceTimersByTime(60 * 1000);
        expect(await refreshSession(first.refreshToken, { store })).toBeNull();
        expect(await refreshSession(next.refreshToken, { store })).toBeNull();
    });

    it("lapses after 14 idle days but keeps going while it is used", async () => {
        const idle = await startSession("user-1", { store });
        vi.advanceTimersByTime(14 * DAY + 1000);
        expect(await refreshSession(idle.refreshToken, { store })).toBeNull();

        let active = await startSession("user-2", { store });
        for (let day = 0; day < 3; day += 1) {
            vi.advanceTimersByTime(8 * DAY);
            active = await refreshSession(active.refreshToken, { store });
            expect(active).not.toBeNull();
        }
    });

    it("never outlives 30 days from sign-in, however often it is refreshed", async () => {
        let pair = await startSession("user-1", { store });
        for (let day = 0; day < 29; day += 1) {
            vi.advanceTimersByTime(DAY);
            pair = await refreshSession(pair.refreshToken, { store });
            expect(pair).not.toBeNull();
        }
        vi.advanceTimersByTime(DAY + 1000);
        expect(await refreshSession(pair.refreshToken, { store })).toBeNull();
    });

    it("ends only the signed-out sign-in, leaving the person's other devices signed in", async () => {
        const laptop = await startSession("user-1", { store });
        const phone = await startSession("user-1", { store });
        await endSession(laptop.refreshToken, { store });
        expect(await refreshSession(laptop.refreshToken, { store })).toBeNull();
        expect(await refreshSession(phone.refreshToken, { store })).not.toBeNull();
    });

    it("refuses tokens it never issued and malformed input", async () => {
        expect(await refreshSession("x".repeat(43), { store })).toBeNull();
        expect(await refreshSession(undefined, { store })).toBeNull();
        expect(await refreshSession("short", { store })).toBeNull();
        await expect(endSession("x".repeat(43), { store })).resolves.toBeUndefined();
    });

    it("treats a token used between its read and its write as used", async () => {
        const first = await startSession("user-1", { store });
        const realReplace = store.replace.bind(store);
        let raced = false;
        store.replace = async (key, content, options) => {
            if (!raced) {
                raced = true;
                const current = store.docs.get(key);
                store.docs.set(key, { content: { ...current.content, usedAt: Date.now() - 60 * 1000 }, cas: current.cas + 1000 });
            }
            return realReplace(key, content, options);
        };
        expect(await refreshSession(first.refreshToken, { store })).toBeNull();
    });

    it("names its sign-in in every access token, and reports a sign-in that has ended", async () => {
        const pair = await startSession("user-1", { store });
        const { sid } = jwt.verify(pair.token, process.env.JWT_SECRET);
        expect(await isSignInLive(sid, { store })).toBe(true);
        await endSession(pair.refreshToken, { store });
        expect(await isSignInLive(sid, { store })).toBe(false);
    });

    it("announces each sign-in it ends, so its live connections can be closed", async () => {
        const pair = await startSession("user-1", { store });
        const ended = vi.fn();
        signInEvents.on("ended", ended);
        await endSession(pair.refreshToken, { store });
        signInEvents.off("ended", ended);
        expect(ended).toHaveBeenCalledWith(jwt.verify(pair.token, process.env.JWT_SECRET).sid);
    });

    it("ends every other sign-in of one person and leaves other people alone", async () => {
        const here = await startSession("user-1", { store });
        const laptop = await startSession("user-1", { store });
        const phone = await startSession("user-1", { store });
        const someoneElse = await startSession("user-2", { store });
        const { sid } = jwt.verify(here.token, process.env.JWT_SECRET);
        const ended = await endOtherSessions("user-1", { except: sid, store });
        expect(ended).toHaveLength(2);
        expect(await refreshSession(laptop.refreshToken, { store })).toBeNull();
        expect(await refreshSession(phone.refreshToken, { store })).toBeNull();
        expect(await refreshSession(here.refreshToken, { store })).not.toBeNull();
        expect(await refreshSession(someoneElse.refreshToken, { store })).not.toBeNull();
    });

    it("carries an agent grant into every access token the sign-in issues", async () => {
        const grant = { kind: "oauth", scope: "read", boards: ["board-1"], agent: "Claude" };
        const pair = await startSession("user-1", { store, grant });
        const renewed = await refreshSession(pair.refreshToken, { store });
        expect(jwt.verify(renewed.token, process.env.JWT_SECRET)).toMatchObject(grant);
        expect(await listGrants("user-1", { store })).toEqual([expect.objectContaining(grant)]);
    });

    it("leaves an embed's sign-in out of the connected agents", async () => {
        await startSession("user-1", { store, grant: { kind: "embed", boards: ["board-1"] } });
        expect(await listGrants("user-1", { store })).toEqual([]);
    });
});
