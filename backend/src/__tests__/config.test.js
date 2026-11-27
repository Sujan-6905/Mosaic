import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEnv, resolveTrustProxyHops, REQUIRED_ENV_VARS, OPTIONAL_ENV_VARS } from "../config.js";
import { appUrl, ownOrigins, resolveCorsOrigins } from "../http/origins.js";
import logger from "../observability/logger.js";

const ALL_VALID_ENV = {
    JWT_SECRET: "a-test-secret-long-enough-for-hmac-signing",
    CB_CONNECTION_STRING: "couchbases://cb.example.cloud.couchbase.com",
    CB_USERNAME: "user",
    CB_PASSWORD: "pass",
    CB_BUCKET_NAME: "whiteboard",
    GROQ_API_KEY: "groq-key",
    REDIS_URL: "redis://localhost:6379",
    MAX_BOARD_COLLABORATORS: "10",
    CLOUDINARY_CLOUD_NAME: "demo-cloud",
    CLOUDINARY_API_KEY: "cloudinary-key",
    CLOUDINARY_API_SECRET: "cloudinary-secret",
    SNAPSHOT_OP_INTERVAL: "200",
    SNAPSHOT_TIME_INTERVAL_MS: "600000",
    HISTORY_RETENTION_DAYS: "30",
    HISTORY_RETENTION_MIN_SNAPSHOTS: "5",
    AI_MODEL_REASONING: "qwen/qwen3.8-27b",
    AI_MODEL_FALLBACK: "openai/gpt-oss-20b,openai/gpt-oss-120b",
    AI_MODEL_PROMPT_GUARD: "meta-llama/llama-prompt-guard-2-86m",
    AI_MODEL_STYLIST: "openai/gpt-oss-20b",
    FRONTEND_SERVER_KEY: "server-key",
    PUBLIC_APP_URL: "https://mosaic.example.com",
    CORS_ORIGINS: "https://mosaic.example.com",
    TRUST_PROXY: "1",
    GITHUB_TOKEN: "github-token",
    ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
    DASHBOARD_TOKEN: "dashboard-token",
    PERSONAL_TOKENS_DISABLED: "false",
    EMBED_LIVE_VIEWER_CAP: "1000",
    SLACK_SIGNING_SECRET: "slack-secret",
    SLACK_BOT_TOKEN: "xoxb-test",
    VAPID_PUBLIC_KEY: "vapid-public",
    VAPID_PRIVATE_KEY: "vapid-private",
    VAPID_SUBJECT: "mailto:test@example.com",
};

let originalEnv;

beforeEach(() => {
    originalEnv = { ...process.env };
    for (const key of [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS]) {
        delete process.env[key];
    }
    vi.spyOn(process, "exit").mockImplementation(() => {});
    vi.spyOn(logger, "fatal").mockImplementation(() => {});
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "info").mockImplementation(() => {});
});

afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
});

describe("validateEnv", () => {
    it("exits when JWT_SECRET is too short to resist guessing", () => {
        process.env.JWT_SECRET = "short";
        validateEnv();
        expect(process.exit).toHaveBeenCalledWith(1);
        expect(logger.fatal).toHaveBeenCalledWith(expect.stringContaining("at least 32"));
    });

    it("does not exit or warn when every required and optional var is set", () => {
        Object.assign(process.env, ALL_VALID_ENV);

        validateEnv();

        expect(process.exit).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
    });

    it("exits with code 1 and names the missing var when a required var is absent", () => {
        Object.assign(process.env, ALL_VALID_ENV);
        delete process.env.JWT_SECRET;

        validateEnv();

        expect(process.exit).toHaveBeenCalledWith(1);
        expect(logger.fatal).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET"));
    });

    it("names every missing required var at once, not just the first", () => {
        Object.assign(process.env, ALL_VALID_ENV);
        delete process.env.JWT_SECRET;
        delete process.env.CB_BUCKET_NAME;

        validateEnv();

        const message = logger.fatal.mock.calls[0][0];
        expect(message).toContain("JWT_SECRET");
        expect(message).toContain("CB_BUCKET_NAME");
    });

    it("names every unset optional var in one line and carries on", () => {
        Object.assign(process.env, ALL_VALID_ENV);
        delete process.env.GROQ_API_KEY;
        delete process.env.REDIS_URL;

        validateEnv();

        expect(process.exit).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info.mock.calls[0][0].unset).toEqual(expect.arrayContaining(["GROQ_API_KEY", "REDIS_URL"]));
    });
});

describe("resolveCorsOrigins", () => {
    it("falls back to the app's own address, never 'allow any origin', when CORS_ORIGINS is unset", () => {
        expect(resolveCorsOrigins({})).toEqual(["http://localhost:3000"]);
        expect(resolveCorsOrigins({ PUBLIC_APP_URL: "https://mosaic.example.com/" })).toEqual(["https://mosaic.example.com"]);
    });

    it("splits and trims a comma-separated CORS_ORIGINS override", () => {
        const result = resolveCorsOrigins({
            CORS_ORIGINS: "https://a.example.com, https://b.example.com ,https://c.example.com",
        });
        expect(result).toEqual(["https://a.example.com", "https://b.example.com", "https://c.example.com"]);
    });

    it("supports a single-origin override", () => {
        expect(resolveCorsOrigins({ CORS_ORIGINS: "https://only.example.com" })).toEqual(["https://only.example.com"]);
    });
});

describe("ownOrigins", () => {
    it("is the app's address plus every CORS origin, without repeats", () => {
        const env = { PUBLIC_APP_URL: "https://mosaic.example.com", CORS_ORIGINS: "https://mosaic.example.com,https://other.example.com" };
        expect(ownOrigins(env)).toEqual(["https://mosaic.example.com", "https://other.example.com"]);
        expect(appUrl(env)).toBe("https://mosaic.example.com");
    });
});

describe("resolveTrustProxyHops", () => {
    it("trusts the one proxy a production host puts in front, and none locally", () => {
        expect(resolveTrustProxyHops({ NODE_ENV: "production" })).toBe(1);
        expect(resolveTrustProxyHops({})).toBe(0);
    });

    it("takes an explicit hop count, including zero", () => {
        expect(resolveTrustProxyHops({ NODE_ENV: "production", TRUST_PROXY: "0" })).toBe(0);
        expect(resolveTrustProxyHops({ TRUST_PROXY: "2" })).toBe(2);
        expect(resolveTrustProxyHops({ NODE_ENV: "production", TRUST_PROXY: "lots" })).toBe(1);
    });
});
