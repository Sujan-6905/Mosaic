import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { ensureSchema } from "./db/connection.js";
// The session store reads and writes this collection by raw keys; the model only provisions it.
import "./models/refreshTokenSchema.js";
import { createApp } from "./http/app.js";
import { resolveCorsOrigins } from "./http/origins.js";
import { redisClient } from "./liveRooms/canvasStore.js";
import socketLogic from "./realtime/boardSocket.js";
import { setIo } from "./realtime/ioRegistry.js";
import { startBackgroundWork } from "./services/backgroundWork.js";
import logger from "./observability/logger.js";
import { recordError } from "./observability/metrics.js";

const PORT = process.env.PORT || 5000;
const origins = resolveCorsOrigins();

// Every model module is imported by now, through the app's routes, so each has registered with Ottoman.
const app = createApp({ origins, port: PORT });
await ensureSchema();

const httpServer = createServer(app);
// Longer than a proxy's or client's idle reuse, so the server never closes a socket just as one is reused.
httpServer.keepAliveTimeout = 65_000;
httpServer.headersTimeout = 66_000;

const io = new Server(httpServer, { cors: { origin: origins, methods: ["GET", "POST"] } });
// Room broadcasts cross instances through Redis, reusing the room store's connection for publishing.
if (redisClient) io.adapter(createAdapter(redisClient, redisClient.duplicate()));
setIo(io);
socketLogic(io);

startBackgroundWork();

// Logged and counted rather than left to Node's default, which ends the process and every live board with it.
process.on("unhandledRejection", (reason) => {
    recordError();
    logger.error({ err: reason }, "unhandled promise rejection");
});

httpServer.listen(PORT, () => logger.info(`server running on http://localhost:${PORT}`));
