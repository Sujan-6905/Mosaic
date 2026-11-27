// Live room state: in this process's memory by default, in Redis when REDIS_URL is set so
// every instance sees the same rooms. Both stores satisfy __tests__/storeContract.js.
import Redis from "ioredis";
import createMemoryStore from "./memoryStore.js";
import createRedisStore from "./redisStore.js";
import logger from "../observability/logger.js";

// Reused as the Socket.io adapter's publisher; null without Redis.
let redisClient = null;

const buildStore = () => {
    if (!process.env.REDIS_URL) {
        return createMemoryStore();
    }

    redisClient = new Redis(process.env.REDIS_URL);
    redisClient.on("error", (err) => logger.error({ err }, "canvas store redis client error"));
    redisClient.on("connect", () => logger.info("canvas store connected to Redis"));

    return createRedisStore(redisClient);
};

const canvasStore = buildStore();

export default canvasStore;
export { redisClient };
