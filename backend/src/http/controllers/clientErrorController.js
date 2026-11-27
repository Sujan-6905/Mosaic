import logger from "../../observability/logger.js";
import { recordClientError } from "../../observability/metrics.js";

// Unauthenticated on purpose, since an error can happen before or during sign-in;
// correlationId ties the report to that action's server activity.
const reportClientError = (req, res) => {
    const { message, stack, componentStack, url, correlationId } = req.body;
    recordClientError();
    logger.error({ stack, componentStack, url, correlationId, userAgent: req.get("user-agent") }, `client error: ${message}`);
    return res.status(204).send();
};

export { reportClientError };
