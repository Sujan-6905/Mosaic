import logger from "../../observability/logger.js";
import { recordError } from "../../observability/metrics.js";

// Registered last: an unhandled throw becomes a clean 500 without a stack trace.
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    // body-parser marks a malformed or oversized body as the client's own mistake.
    if (err.type === "entity.parse.failed") return res.status(400).json({ message: "The request body isn't valid JSON." });
    if (err.type === "entity.too.large") return res.status(413).json({ message: "The request body is too large." });

    recordError();
    logger.error({ err, method: req.method, path: req.path }, "unhandled error in request handler");

    return res.status(500).json({ message: "Internal server error" });
};

export default errorHandler;
