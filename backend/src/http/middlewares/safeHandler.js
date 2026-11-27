import { recordError } from "../../observability/metrics.js";

// A thrown or rejected socket handler must never take the process down for everyone.
const safeHandler =
    (socket, eventName, handler, { onError } = {}) =>
    async (...args) => {
        try {
            await handler(...args);
        } catch (error) {
            recordError();
            const log = socket.log ?? console;
            log.error({ err: error, event: eventName }, "unhandled error in socket handler");
            onError?.(error);
        }
    };

export default safeHandler;
