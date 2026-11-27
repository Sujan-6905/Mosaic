// The client's per-action correlation id, else pino-http's request id, echoed on the
// response so one browser action's server log lines can be found together.
const correlationId = (req, res, next) => {
    const incoming = req.headers["x-correlation-id"];
    req.correlationId = typeof incoming === "string" && incoming.length > 0 ? incoming : req.id;
    res.setHeader("X-Correlation-Id", req.correlationId);
    next();
};

export default correlationId;
