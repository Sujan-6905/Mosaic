import { describe, it, expect, beforeEach, vi } from "vitest";

const accessToken = await import("../accessToken");
const { default: axiosInstance, resetSessionExpiredGuard } = await import("../axiosInstance");

// Answers 401 to any token but the one it currently accepts.
const backend = (accepted) =>
    vi.fn(async (config) => {
        if (config.headers.Authorization === `Bearer ${accepted.current}`) return { status: 200, data: { ok: true }, headers: {}, config };
        const error = new Error("Request failed with status code 401");
        error.config = config;
        error.response = { status: 401, data: {}, headers: {}, config };
        throw error;
    });

let expired;

beforeEach(() => {
    resetSessionExpiredGuard();
    expired = vi.fn();
    window.addEventListener("mosaic:session-expired", expired);
    accessToken.noteAccessToken("old");
});

describe("a refused access token", () => {
    it("is renewed once for every request refused at the same moment, and each retries", async () => {
        const accepted = { current: "new" };
        axiosInstance.defaults.adapter = backend(accepted);
        const renew = vi.fn(async () => ({ accessToken: "new" }));
        accessToken.setSessionRenewer(renew);

        const results = await Promise.all(["/a", "/b", "/c"].map((url) => axiosInstance.get(url, { headers: { Authorization: "Bearer old" } })));
        expect(results.every((result) => result.data.ok)).toBe(true);
        expect(renew).toHaveBeenCalledTimes(1);
        expect(expired).not.toHaveBeenCalled();
    });

    it("retries with the newer token without renewing again when another caller already did", async () => {
        accessToken.noteAccessToken("new");
        axiosInstance.defaults.adapter = backend({ current: "new" });
        const renew = vi.fn();
        accessToken.setSessionRenewer(renew);

        await expect(axiosInstance.get("/late", { headers: { Authorization: "Bearer old" } })).resolves.toMatchObject({ status: 200 });
        expect(renew).not.toHaveBeenCalled();
    });

    it("signs out when the sign-in has ended", async () => {
        axiosInstance.defaults.adapter = backend({ current: "never" });
        accessToken.setSessionRenewer(async () => ({ error: "SessionEnded" }));

        await expect(axiosInstance.get("/a", { headers: { Authorization: "Bearer old" } })).rejects.toMatchObject({ response: { status: 401 } });
        expect(expired).toHaveBeenCalledTimes(1);
    });

    it("doesn't renew again when the token it just renewed is refused too", async () => {
        axiosInstance.defaults.adapter = backend({ current: "never" });
        const renew = vi.fn(async () => ({ accessToken: "fresh" }));
        accessToken.setSessionRenewer(renew);

        await expect(axiosInstance.get("/a", { headers: { Authorization: "Bearer old" } })).rejects.toBeTruthy();
        await expect(axiosInstance.get("/b", { headers: { Authorization: "Bearer fresh" } })).rejects.toBeTruthy();
        expect(renew).toHaveBeenCalledTimes(1);
    });

    it("retries only once, so a backend that keeps refusing can't loop", async () => {
        const adapter = backend({ current: "never" });
        axiosInstance.defaults.adapter = adapter;
        accessToken.setSessionRenewer(async () => ({ accessToken: `fresh-${Math.random()}` }));

        await expect(axiosInstance.get("/a", { headers: { Authorization: "Bearer old" } })).rejects.toBeTruthy();
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(expired).toHaveBeenCalledTimes(1);
    });
});
