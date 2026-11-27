import { redisClient } from "../liveRooms/canvasStore.js";
import { reconnectDb } from "../db/connection.js";
import { createDbWatchdog } from "../db/watchdog.js";
import { checkDbHealth, checkRedisHealth } from "../observability/health.js";
import { sendAlert } from "../observability/alerts.js";
import logger from "../observability/logger.js";
import { purgeSweptBoards } from "./boardSweep.js";
import { forgetSubscriptionsOfEndedSignIns } from "./webPush.js";

const HEALTH_CHECK_INTERVAL_MS = 20 * 1000;
// Swept boards past their grace period go for good; a few hours late is fine.
const SWEPT_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Runs the /healthz checks on a timer, so an outage alerts even when nobody calls /healthz.
const startHealthWatch = () => {
    const dbWatchdog = createDbWatchdog({
        check: checkDbHealth,
        reconnect: reconnectDb,
        onUnhealthy: (db) => sendAlert("db-unavailable", { error: db.error }),
    });
    setInterval(async () => {
        await dbWatchdog.tick();
        if (!redisClient) return;
        const redis = await checkRedisHealth(redisClient);
        if (!redis.healthy) sendAlert("redis-unavailable", { error: redis.error });
    }, HEALTH_CHECK_INTERVAL_MS);
};

const startSweptBoardPurge = () => {
    const purge = () => purgeSweptBoards().catch((error) => logger.error({ err: error }, "purging swept boards failed"));
    setInterval(purge, SWEPT_PURGE_INTERVAL_MS).unref();
    purge();
};

// Timers and listeners that run for the life of the process, outside any request.
export const startBackgroundWork = () => {
    startHealthWatch();
    startSweptBoardPurge();
    forgetSubscriptionsOfEndedSignIns();
};
