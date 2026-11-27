import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ottoman", () => ({
    getDefaultInstance: vi.fn(),
}));

const { getDefaultInstance } = await import("ottoman");
const { checkDbHealth, checkRedisHealth } = await import("../health.js");

class DocumentNotFoundError extends Error {
    name = "DocumentNotFoundError";
}

const instanceWith = ({ kv = vi.fn().mockRejectedValue(new DocumentNotFoundError()), query = vi.fn().mockResolvedValue({ rows: [] }) } = {}) => ({
    getCollection: () => ({ get: kv }),
    cluster: { query },
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("checkDbHealth", () => {
    it("is healthy when a key-value read answers, even with a miss, and a query answers", async () => {
        getDefaultInstance.mockReturnValue(instanceWith());
        expect(await checkDbHealth()).toEqual({ healthy: true });
    });

    it("is unhealthy when key-value reads time out but queries still work", async () => {
        getDefaultInstance.mockReturnValue(instanceWith({ kv: vi.fn().mockRejectedValue(new Error("unambiguous timeout")) }));
        const result = await checkDbHealth();
        expect(result.healthy).toBe(false);
        expect(result.error).toContain("kv: unambiguous timeout");
    });

    it("is unhealthy when queries fail", async () => {
        getDefaultInstance.mockReturnValue(instanceWith({ query: vi.fn().mockRejectedValue(new Error("ambiguous timeout")) }));
        const result = await checkDbHealth();
        expect(result.healthy).toBe(false);
        expect(result.error).toContain("query: ambiguous timeout");
    });
});

describe("checkRedisHealth", () => {
    it("reports healthy when PING replies PONG", async () => {
        const result = await checkRedisHealth({ ping: vi.fn().mockResolvedValue("PONG") });
        expect(result).toEqual({ healthy: true });
    });

    it("reports unhealthy when PING rejects (connection down)", async () => {
        const result = await checkRedisHealth({ ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) });
        expect(result.healthy).toBe(false);
        expect(result.error).toContain("ECONNREFUSED");
    });
});
