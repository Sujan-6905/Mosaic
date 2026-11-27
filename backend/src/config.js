import logger from "./observability/logger.js";

// Fails fast with a named variable instead of an opaque connection error later.
const REQUIRED_ENV_VARS = ["JWT_SECRET", "CB_CONNECTION_STRING", "CB_USERNAME", "CB_PASSWORD", "CB_BUCKET_NAME"];

// Absent means that feature is off. Without REDIS_URL, rooms live in this process's memory.
const OPTIONAL_ENV_VARS = [
    "PUBLIC_APP_URL",
    "CORS_ORIGINS",
    "TRUST_PROXY",
    "GROQ_API_KEY",
    "GITHUB_TOKEN",
    "REDIS_URL",
    "MAX_BOARD_COLLABORATORS",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "SNAPSHOT_OP_INTERVAL",
    "SNAPSHOT_TIME_INTERVAL_MS",
    "HISTORY_RETENTION_DAYS",
    "HISTORY_RETENTION_MIN_SNAPSHOTS",
    "AI_MODEL_REASONING",
    "AI_MODEL_FALLBACK",
    "AI_MODEL_PROMPT_GUARD",
    "AI_MODEL_STYLIST",
    "FRONTEND_SERVER_KEY",
    "ALERT_WEBHOOK_URL",
    "DASHBOARD_TOKEN",
    "PERSONAL_TOKENS_DISABLED",
    "EMBED_LIVE_VIEWER_CAP",
    "SLACK_SIGNING_SECRET",
    "SLACK_BOT_TOKEN",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
];

const MIN_SECRET_LENGTH = 32;

const validateEnv = () => {
    const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        logger.fatal(`Missing required environment variable(s): ${missing.join(", ")}. ` + "Copy backend/.env.example to backend/.env and fill them in.");
        process.exit(1);
    }

    // Every access token is an HMAC under this secret; a short one can be guessed offline from any token.
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
        logger.fatal(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: openssl rand -base64 48`);
        process.exit(1);
    }

    const unsetOptional = OPTIONAL_ENV_VARS.filter((key) => !process.env[key]);
    if (unsetOptional.length > 0) {
        logger.info({ unset: unsetOptional }, "optional settings not set, using their defaults");
    }
};

// Lower it locally to see a full board refuse the next editor without opening ten tabs.
const DEFAULT_MAX_BOARD_COLLABORATORS = 10;

const resolveMaxBoardCollaborators = (env = process.env) => {
    const parsed = Number(env.MAX_BOARD_COLLABORATORS);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BOARD_COLLABORATORS;
};

// How many proxies sit in front of the app (Render adds one), so rate limits key on the
// person's own address rather than the proxy's. TRUST_PROXY=0 turns it off.
const resolveTrustProxyHops = (env = process.env) => {
    const parsed = Number(env.TRUST_PROXY);
    if (env.TRUST_PROXY !== undefined && Number.isInteger(parsed) && parsed >= 0) return parsed;
    return env.NODE_ENV === "production" ? 1 : 0;
};

// A snapshot follows whichever comes first: a burst of operations or time on a quiet board.
const DEFAULT_SNAPSHOT_OP_INTERVAL = 200;
const DEFAULT_SNAPSHOT_TIME_INTERVAL_MS = 10 * 60 * 1000;
// Compaction keeps this many days of snapshots, and never fewer than the minimum count.
const DEFAULT_HISTORY_RETENTION_DAYS = 30;
const DEFAULT_HISTORY_RETENTION_MIN_SNAPSHOTS = 5;

const resolvePositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveSnapshotOpInterval = (env = process.env) => resolvePositiveInt(env.SNAPSHOT_OP_INTERVAL, DEFAULT_SNAPSHOT_OP_INTERVAL);

const resolveSnapshotTimeIntervalMs = (env = process.env) => resolvePositiveInt(env.SNAPSHOT_TIME_INTERVAL_MS, DEFAULT_SNAPSHOT_TIME_INTERVAL_MS);

const resolveHistoryRetentionDays = (env = process.env) => resolvePositiveInt(env.HISTORY_RETENTION_DAYS, DEFAULT_HISTORY_RETENTION_DAYS);

const resolveHistoryRetentionMinSnapshots = (env = process.env) =>
    resolvePositiveInt(env.HISTORY_RETENTION_MIN_SNAPSHOTS, DEFAULT_HISTORY_RETENTION_MIN_SNAPSHOTS);

export {
    validateEnv,
    resolveMaxBoardCollaborators,
    resolveTrustProxyHops,
    resolveSnapshotOpInterval,
    resolveSnapshotTimeIntervalMs,
    resolveHistoryRetentionDays,
    resolveHistoryRetentionMinSnapshots,
    REQUIRED_ENV_VARS,
    OPTIONAL_ENV_VARS,
};
