import { getDefaultInstance } from "ottoman";
import { nullIfMissing } from "../db/errors.js";

const PROBE_TIMEOUT_MS = 4000;
const PROBE_KEY = "__health_probe__";
const PROBE_COLLECTION = "users";
const PROBE_SCOPE = "app";

// Checks both key-value and query paths, since either can stay dead while the other
// recovers; ping would also report services the app never calls.
const checkDbHealth = async () => {
    const instance = getDefaultInstance();
    const [kv, query] = await Promise.allSettled([
        nullIfMissing(() => instance.getCollection(PROBE_COLLECTION, PROBE_SCOPE).get(PROBE_KEY, { timeout: PROBE_TIMEOUT_MS })),
        instance.cluster.query("SELECT 1", { timeout: PROBE_TIMEOUT_MS }),
    ]);
    const failures = [kv.status === "rejected" && `kv: ${kv.reason.message}`, query.status === "rejected" && `query: ${query.reason.message}`].filter(Boolean);
    return failures.length === 0 ? { healthy: true } : { healthy: false, error: failures.join("; ") };
};

// Only called when a redisClient exists, that is when REDIS_URL is set.
// PING is enough to prove the connection is live without touching data.
const checkRedisHealth = async (redisClient) => {
    try {
        const result = await redisClient.ping();
        return { healthy: result === "PONG" };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
};

export { checkDbHealth, checkRedisHealth };
