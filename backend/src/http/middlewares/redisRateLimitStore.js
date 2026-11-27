// Counts hits in Redis, so every instance behind the load balancer enforces one shared limit per key.
export default class RedisRateLimitStore {
    localKeys = false;

    constructor(redis, name) {
        this.redis = redis;
        this.prefix = `rate:${name}:`;
    }

    init({ windowMs }) {
        this.windowMs = windowMs;
    }

    async increment(key) {
        const redisKey = this.prefix + key;
        const [, [, totalHits], [, remainingMs]] = await this.redis.multi().set(redisKey, 0, "PX", this.windowMs, "NX").incr(redisKey).pttl(redisKey).exec();
        return { totalHits, resetTime: new Date(Date.now() + Math.max(remainingMs, 0)) };
    }

    // A key that expired since its increment would otherwise come back from DECR with no expiry at all.
    async decrement(key) {
        const redisKey = this.prefix + key;
        const [, [, remainingMs]] = await this.redis.multi().decr(redisKey).pttl(redisKey).exec();
        if (remainingMs < 0) await this.redis.pexpire(redisKey, this.windowMs);
    }

    async resetKey(key) {
        await this.redis.del(this.prefix + key);
    }
}
