import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const saveSubscription = vi.fn().mockResolvedValue(undefined);
const removeSubscription = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../models/pushSubscriptionSchema.js", () => ({ default: {} }));
vi.mock("../../../services/webPush.js", async (importOriginal) => ({
    ...(await importOriginal()),
    saveSubscription: (...args) => saveSubscription(...args),
    removeSubscription: (...args) => removeSubscription(...args),
}));
vi.mock("../../../auth/sessionTokens.js", async (importOriginal) => ({ ...(await importOriginal()), isSignInLive: async () => true }));
const pushRoutes = (await import("../pushRoutes.js")).default;

const app = express();
app.use(express.json());
app.use("/api/push", pushRoutes);
const asPerson = `Bearer ${jwt.sign({ userId: "u1", sid: "sid-1" }, process.env.JWT_SECRET)}`;
const asAgent = `Bearer ${jwt.sign({ userId: "u1", sid: "sid-2", agent: "Claude" }, process.env.JWT_SECRET)}`;
const asPersonalToken = `Bearer ${jwt.sign({ userId: "u1", sid: "pat:abc" }, process.env.JWT_SECRET)}`;
const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = "public-key";
    process.env.VAPID_PRIVATE_KEY = "private-key";
});

afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
});

describe("push routes", () => {
    it("hand out the public key, or null when this server has none", async () => {
        expect((await request(app).get("/api/push/key")).body).toEqual({ publicKey: "public-key" });
        delete process.env.VAPID_PRIVATE_KEY;
        expect((await request(app).get("/api/push/key")).body).toEqual({ publicKey: null });
    });

    it("save a browser's subscription for the person signed in", async () => {
        const res = await request(app).post("/api/push/subscriptions").set("Authorization", asPerson).send(subscription);
        expect(res.status).toBe(201);
        expect(saveSubscription).toHaveBeenCalledWith("u1", "sid-1", subscription);
    });

    it("refuse an address that isn't a browser push service", async () => {
        const res = await request(app)
            .post("/api/push/subscriptions")
            .set("Authorization", asPerson)
            .send({ ...subscription, endpoint: "https://10.0.0.5/internal" });
        expect(res.status).toBe(400);
        expect(saveSubscription).not.toHaveBeenCalled();
    });

    it("refuse an agent's sign-in", async () => {
        const res = await request(app).post("/api/push/subscriptions").set("Authorization", asAgent).send(subscription);
        expect(res.status).toBe(403);
    });

    it("refuse a personal access token, which isn't a browser", async () => {
        const res = await request(app).post("/api/push/subscriptions").set("Authorization", asPersonalToken).send(subscription);
        expect(res.status).toBe(403);
        expect(saveSubscription).not.toHaveBeenCalled();
    });

    it("say so when the browser belongs to another sign-in", async () => {
        const { SubscriptionHeldElsewhere } = await import("../../../services/webPush.js");
        saveSubscription.mockRejectedValueOnce(new SubscriptionHeldElsewhere());
        const res = await request(app).post("/api/push/subscriptions").set("Authorization", asPerson).send(subscription);
        expect(res.status).toBe(409);
    });

    it("forget a browser on request", async () => {
        const res = await request(app).delete("/api/push/subscriptions").set("Authorization", asPerson).send({ endpoint: subscription.endpoint });
        expect(res.status).toBe(204);
        expect(removeSubscription).toHaveBeenCalledWith("u1", subscription.endpoint);
    });
});
