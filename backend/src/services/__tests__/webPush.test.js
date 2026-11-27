import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const query = vi.fn();
const create = vi.fn();
vi.mock("ottoman", () => ({ getDefaultInstance: () => ({ query: (...args) => query(...args) }) }));
vi.mock("../../models/pushSubscriptionSchema.js", () => ({ default: { create: (...args) => create(...args) } }));
vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
const isSignInLive = vi.fn().mockResolvedValue(true);
const { EventEmitter } = await import("node:events");
const signInEvents = new EventEmitter();
vi.mock("../../auth/sessionTokens.js", () => ({ isSignInLive: (...args) => isSignInLive(...args), signInEvents }));
const { forgetSubscriptionsOfEndedSignIns, isPushServiceEndpoint, mentionMessage, pushPublicKey, pushToUser, saveSubscription, SubscriptionHeldElsewhere } =
    await import("../webPush.js");

const subscription = (endpoint, sid = "sid-1") => ({ sid, endpoint, p256dh: "key", auth: "secret" });
const browser = { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "key", auth: "secret" } };

beforeEach(() => {
    vi.clearAllMocks();
    isSignInLive.mockResolvedValue(true);
    query.mockResolvedValue({ rows: [] });
    process.env.CB_BUCKET_NAME = "test-bucket";
    process.env.VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
});

afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
});

describe("isPushServiceEndpoint", () => {
    it("accepts the browsers' own push services over https", () => {
        expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
        expect(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
        expect(isPushServiceEndpoint("https://web.push.apple.com/abc")).toBe(true);
        expect(isPushServiceEndpoint("https://db5p.notify.windows.com/w/?token=abc")).toBe(true);
    });

    it("refuses any other host, plain http, an explicit port or a look-alike name", () => {
        expect(isPushServiceEndpoint("https://169.254.169.254/latest")).toBe(false);
        expect(isPushServiceEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
        expect(isPushServiceEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
        expect(isPushServiceEndpoint("https://evilfcm.googleapis.com.example.net/x")).toBe(false);
        expect(isPushServiceEndpoint("not a url")).toBe(false);
    });
});

describe("pushPublicKey", () => {
    it("is null until both keys are set", () => {
        expect(pushPublicKey()).toBe("public");
        delete process.env.VAPID_PRIVATE_KEY;
        expect(pushPublicKey()).toBeNull();
    });
});

describe("mentionMessage", () => {
    it("names who mentioned you and where, and opens that board", () => {
        expect(mentionMessage({ actorName: "Ada", boardTitle: "Q3 plan", preview: "can you check this?", shareId: "b 1", commentId: "c9" })).toEqual({
            title: "Ada mentioned you",
            body: "On Q3 plan: can you check this?",
            url: "/?shareId=b%201",
            tag: "mention:c9",
        });
    });
});

describe("saveSubscription", () => {
    it("replaces whatever this browser had registered, under the sign-in now using it", async () => {
        await saveSubscription("u1", "sid-1", browser);
        expect(query.mock.calls[1][0]).toMatch(/^DELETE/);
        expect(create).toHaveBeenCalledWith({ userId: "u1", sid: "sid-1", endpoint: browser.endpoint, p256dh: "key", auth: "secret" });
    });

    it("hands a shared browser to whoever signs in on it, since they send the same keys", async () => {
        query.mockResolvedValueOnce({ rows: [{ userId: "someone-else", p256dh: "key", auth: "secret" }] });
        await saveSubscription("u1", "sid-1", browser);
        expect(create).toHaveBeenCalled();
    });

    it("won't let someone who only knows another person's address take it over", async () => {
        query.mockResolvedValueOnce({ rows: [{ userId: "victim", p256dh: "their-key", auth: "their-secret" }] });
        await expect(saveSubscription("attacker", "sid-9", { ...browser, keys: { p256dh: "mine", auth: "mine" } })).rejects.toBeInstanceOf(
            SubscriptionHeldElsewhere,
        );
        expect(create).not.toHaveBeenCalled();
    });
});

describe("forgetSubscriptionsOfEndedSignIns", () => {
    it("drops a sign-in's subscriptions the moment that sign-in ends", async () => {
        forgetSubscriptionsOfEndedSignIns();
        signInEvents.emit("ended", "sid-7");
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/^DELETE .* s\.sid = \$sid/), { parameters: { sid: "sid-7" } });
    });
});

describe("pushToUser", () => {
    it("sends to each of the person's browsers and forgets one the push service no longer knows", async () => {
        query.mockResolvedValueOnce({ rows: [subscription("https://fcm.googleapis.com/a"), subscription("https://fcm.googleapis.com/gone")] });
        const send = vi.fn(async ({ endpoint }) => {
            if (endpoint.endsWith("gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
        });

        const delivered = await pushToUser("u1", { title: "hi" }, { send });

        expect(delivered).toBe(1);
        expect(send).toHaveBeenCalledWith(
            { endpoint: "https://fcm.googleapis.com/a", keys: { p256dh: "key", auth: "secret" } },
            JSON.stringify({ title: "hi" }),
            { TTL: 86400 },
        );
        expect(query).toHaveBeenLastCalledWith(expect.stringMatching(/^DELETE/), { parameters: { endpoint: "https://fcm.googleapis.com/gone" } });
    });

    it("never sends to a browser whose sign-in has ended, and forgets it", async () => {
        query.mockResolvedValueOnce({ rows: [subscription("https://fcm.googleapis.com/live", "on"), subscription("https://fcm.googleapis.com/old", "off")] });
        isSignInLive.mockImplementation(async (sid) => sid === "on");
        const send = vi.fn();

        expect(await pushToUser("u1", { title: "hi" }, { send })).toBe(1);
        expect(send).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(expect.stringMatching(/^DELETE/), { parameters: { endpoint: "https://fcm.googleapis.com/old" } });
    });

    it("sends nothing when the server has no push keys", async () => {
        delete process.env.VAPID_PRIVATE_KEY;
        const send = vi.fn();
        expect(await pushToUser("u1", { title: "hi" }, { send })).toBe(0);
        expect(send).not.toHaveBeenCalled();
    });
});
