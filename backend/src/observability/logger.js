import pino from "pino";

// LOG_LEVEL defaults to "info"; test/setup.js forces "silent" so the
// backend test suite's output stays readable.
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// A logger bound to the socket's id, user and correlation id, which ties a browser action
// to the server lines it produced.
const childLoggerForSocket = (socket) => logger.child({ socketId: socket.id, userId: socket.userId, correlationId: socket.correlationId });

// The dashboard takes its secret in the query string; access logs keep the rest of the URL.
const withoutSecretParams = (url = "") => url.replace(/([?&](?:token|access_token|code)=)[^&#]*/g, "$1[redacted]");

export default logger;
export { childLoggerForSocket, withoutSecretParams };
