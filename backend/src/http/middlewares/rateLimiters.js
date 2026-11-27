import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { redisClient } from "../../liveRooms/canvasStore.js";
import RedisRateLimitStore from "./redisRateLimitStore.js";

const TRY_AGAIN = "Too many requests, please try again in a minute.";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const byAddress = (req) => ipKeyGenerator(req.clientIp ?? req.ip);
const byUser = (req) => req.user.userId;
const accountKey = (req) =>
    String(req.body?.username ?? "")
        .trim()
        .toLowerCase();

// Shared through Redis when it is configured; a Redis outage lets requests through rather than failing them.
const limiter = ({ name, windowMs, limit, message = TRY_AGAIN, code, keyGenerator = byAddress, ...options }) =>
    rateLimit({
        windowMs,
        limit,
        keyGenerator,
        standardHeaders: true,
        legacyHeaders: false,
        passOnStoreError: true,
        message: code ? { message, code } : { message },
        ...(redisClient && { store: new RedisRateLimitStore(redisClient, name) }),
        ...options,
    });

// Signing up and anything that checks a password.
export const authLimiter = limiter({ name: "auth", windowMs: MINUTE, limit: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 10 });

// Wrong passwords for one account from one address, so someone elsewhere can't lock a person out.
export const loginAccountLimiter = limiter({
    name: "login-account",
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${accountKey(req)}:${byAddress(req)}`,
    message: "Too many wrong tries for this account. Try again in 15 minutes.",
    code: "account_locked",
});

// A looser ceiling per account across every address, so guesses spread over a botnet still crawl.
export const loginAccountCeiling = limiter({
    name: "login-account-all",
    windowMs: HOUR,
    limit: 50,
    skipSuccessfulRequests: true,
    keyGenerator: accountKey,
    message: "Too many wrong tries for this account. Try again in an hour.",
    code: "account_locked",
});

// Every open tab renews its access token about every quarter hour; sized for an office sharing one address.
export const sessionLimiter = limiter({ name: "session", windowMs: MINUTE, limit: 120 });

// Every assistant route, reads included, so it is sized for a panel opening and loading a thread.
export const aiLimiter = limiter({ name: "ai", windowMs: MINUTE, limit: 60, message: "Too many AI requests, please slow down." });

export const aiTurnLimiter = limiter({
    name: "ai-turn",
    windowMs: MINUTE,
    limit: 15,
    keyGenerator: byUser,
    message: "You're sending messages faster than the assistant can keep up. Try again in a minute.",
    code: "turn_rate_limited",
});

// Each call can download a whole repository.
export const architectureLimiter = limiter({
    name: "architecture",
    windowMs: MINUTE,
    limit: 6,
    keyGenerator: byUser,
    message: "That's a lot of repository requests. Give it a minute.",
});

// A component re-rendering in a loop must not turn one bug into a flood of log writes.
export const clientErrorLimiter = limiter({ name: "client-error", windowMs: MINUTE, limit: 30, message: "Too many error reports, please slow down." });

// Icon search sends a request per typing pause.
export const iconLimiter = limiter({ name: "icon", windowMs: MINUTE, limit: 120, message: "Too many icon requests, please slow down." });

export const usernameCheckLimiter = limiter({ name: "username-check", windowMs: MINUTE, limit: 60 });

// Each signature is one upload to the shared image store.
export const uploadSignatureLimiter = limiter({
    name: "upload-signature",
    windowMs: HOUR,
    limit: 120,
    keyGenerator: byUser,
    message: "Too many uploads this hour. Try again later.",
    code: "upload_rate_limited",
});

export const accessRequestLimiter = limiter({
    name: "access-request",
    windowMs: HOUR,
    limit: 10,
    keyGenerator: byUser,
    message: "That's a lot of requests. Try again in an hour.",
});

// Readable without an account, so limited per address.
export const galleryLimiter = limiter({ name: "gallery", windowMs: MINUTE, limit: 60 });

// Embeds load at whatever rate their visitors arrive; this only stops one address hammering a board.
export const embedLimiter = limiter({ name: "embed", windowMs: MINUTE, limit: 300 });

// Setting a stone needs no account, so a single address can't lay the landing wall by itself.
export const wallStoneLimiter = limiter({
    name: "wall-stone",
    windowMs: HOUR,
    limit: 6,
    message: "That's enough stones from here for now. Come back later.",
    code: "wall_rate_limited",
});

// The wall is polled while the landing page is open.
export const wallReadLimiter = limiter({ name: "wall-read", windowMs: MINUTE, limit: 40 });

// A letter is opened by its reader a handful of times; this only stops someone guessing links.
export const letterReadLimiter = limiter({
    name: "letter-read",
    windowMs: 15 * MINUTE,
    limit: 60,
    message: "Too many letters opened from here. Try again shortly.",
});
