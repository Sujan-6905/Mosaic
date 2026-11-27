import "dotenv/config";
import { connect, start, getDefaultInstance } from "ottoman";
import { validateEnv } from "../config.js";
import { retryUntilDone } from "./retryUntilDone.js";
import logger from "../observability/logger.js";

// Before connect(), so a missing CB_* setting fails with its name rather than an opaque Ottoman error.
validateEnv();

// Connects at import: Ottoman's model() returns undefined before connect() resolves, so
// every model file imports this first.
const CONNECT_ATTEMPTS = 5;
const CONNECT_BASE_DELAY_MS = 2000;
// The SDK's default is 75 seconds, which during an outage leaves every board page
// and login hanging that long before it can say anything.
const QUERY_TIMEOUT_MS = 20_000;

const connectionOptions = () => ({
    connectionString: process.env.CB_CONNECTION_STRING,
    bucketName: process.env.CB_BUCKET_NAME,
    username: process.env.CB_USERNAME,
    password: process.env.CB_PASSWORD,
    timeouts: { queryTimeout: QUERY_TIMEOUT_MS },
});

// A waking cluster can be briefly unreachable; retry, then exit rather than serve every
// request as a 500.
const connectWithRetry = async () => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            await connect(connectionOptions());
            return;
        } catch (error) {
            if (attempt === CONNECT_ATTEMPTS) throw error;
            const retryInMs = CONNECT_BASE_DELAY_MS * 2 ** (attempt - 1);
            logger.warn({ err: error, attempt, retryInMs }, "db connection failed, retrying");
            await new Promise((resolve) => setTimeout(resolve, retryInMs));
        }
    }
};

try {
    await connectWithRetry();
    logger.info("connected to db successfully");
} catch (error) {
    logger.fatal({ err: error }, "could not connect to db, exiting");
    process.exit(1);
}

// Composite and expression indexes Ottoman's schema can't declare: shared boards, invite
// search, history ranges, inboxes and the swept-board purge.
const HAND_WRITTEN_INDEXES = [
    ["idx_drawings_collaborator_ids", "drawings", "DISTINCT ARRAY c.userId FOR c IN collaborators END"],
    ["idx_users_username_lower", "users", "LOWER(username)"],
    ["idx_operation_logs_share_seq", "operationLogs", "shareId, seq"],
    ["idx_operation_logs_share_ts", "operationLogs", "shareId, ts"],
    ["idx_snapshots_share_seq", "snapshots", "shareId, seq"],
    ["idx_notifications_user_created", "notifications", "userId, createdAt"],
    ["idx_drawings_deleted_at", "drawings", "deletedAt"],
];

// One at a time: a small cluster rejects index builds that overlap.
const ensureHandWrittenIndexes = async () => {
    for (const [name, collection, keys] of HAND_WRITTEN_INDEXES) {
        await getDefaultInstance().query(`CREATE INDEX ${name} IF NOT EXISTS ON \`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`${collection}\`(${keys})`);
    }
};

// Called once every model is registered, since start() only provisions known models. Both steps are
// safe to repeat, and an index service can fail either one on a new bucket.
const ensureSchema = () =>
    retryUntilDone(
        async () => {
            await start();
            await ensureHandWrittenIndexes();
            logger.info("collections and indexes ensured");
        },
        (error, details) => logger.error({ err: error, ...details }, "error ensuring collections/indexes, retrying"),
    );

// Repointing the instance moves every model to the new cluster at once. The old one is
// closed without waiting, since a stuck cluster may never answer.
const reconnectDb = async () => {
    const instance = getDefaultInstance();
    const stale = instance.cluster;
    await instance.connect(connectionOptions());
    stale.close().catch((error) => logger.warn({ err: error }, "closing the replaced db connection failed"));
};

export { ensureSchema, reconnectDb };
