import logger from "../observability/logger.js";

// After a long outage the SDK's key-value connection can stay dead while queries recover,
// so a connection failing for a while is replaced with a fresh one.
const FAILURES_BEFORE_RECONNECT = 3;

export const createDbWatchdog = ({ check, reconnect, onUnhealthy }) => {
    let failures = 0;
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const health = await check();
            if (health.healthy) {
                if (failures > 0) logger.info({ failures }, "db connection healthy again");
                failures = 0;
                return;
            }

            failures += 1;
            onUnhealthy(health);
            if (failures < FAILURES_BEFORE_RECONNECT) return;

            logger.warn({ failures, error: health.error }, "replacing the db connection");
            await reconnect();
            failures = 0;
            logger.info("db connection replaced");
        } catch (error) {
            logger.error({ err: error }, "could not replace the db connection, will try again");
        } finally {
            running = false;
        }
    };

    return { tick };
};
