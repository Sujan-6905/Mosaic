import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { resolveTrustProxyHops } from "../config.js";
import logger, { withoutSecretParams } from "../observability/logger.js";
import { collectServerMetrics } from "../observability/serverMetrics.js";
import correlationId from "./middlewares/correlationId.js";
import { resolveClientIp } from "./middlewares/frontendServer.js";
import errorHandler from "./middlewares/errorHandler.js";
import { authLimiter, sessionLimiter, aiLimiter, clientErrorLimiter } from "./middlewares/rateLimiters.js";
import { slackEvents } from "./controllers/slackController.js";
import statusRoutes from "./routes/statusRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import agentAccessRoutes from "./routes/agentAccessRoutes.js";
import drawingRoutes from "./routes/drawingRoutes.js";
import drawingSettingsRoutes from "./routes/drawingSettingsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import architectureRoutes from "./routes/architectureRoutes.js";
import groundingRoutes from "./routes/groundingRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import clientErrorRoutes from "./routes/clientErrorRoutes.js";
import pieceRoutes from "./routes/pieceRoutes.js";
import iconRoutes from "./routes/iconRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import letterRoutes from "./routes/letterRoutes.js";
import createOpsDashboardRouter from "./routes/opsDashboardRoutes.js";
import { createMcpRouter } from "./routes/mcpRoutes.js";
import { createWallRouter } from "./routes/wallRoutes.js";
import { wellKnownRouter, oauthRouter, oauthApiRouter } from "./routes/oauthRoutes.js";
import { embedRouter, oembedRouter } from "./routes/embedRoutes.js";

// Security headers, request logging and body parsing, then every route, then the error handler.
export const createApp = ({ origins, port }) => {
    const app = express();
    app.set("trust proxy", resolveTrustProxyHops());

    app.use(helmet());
    app.use(cors({ origin: origins }));
    app.use(
        pinoHttp({
            logger,
            customProps: (req) => ({ correlationId: req.correlationId }),
            serializers: { req: (req) => ({ ...req, url: withoutSecretParams(req.url) }) },
        }),
    );
    app.use(correlationId);
    app.use(resolveClientIp);
    // Slack signs the raw body, so this one route reads it before any JSON parsing.
    app.post("/api/slack/events", express.raw({ type: "application/json", limit: "1mb" }), slackEvents);
    // A whole piece set arrives in one body when a set file is imported.
    app.use("/api/pieces", express.json({ limit: "2mb" }));
    // One agent tool call can carry a full-length stroke, which the board accepts up to 512 KB.
    app.use("/mcp", express.json({ limit: "1mb" }));
    app.use(express.json());

    app.use(statusRoutes);
    app.use("/api/auth/session", sessionLimiter, sessionRoutes);
    app.use("/api/auth", agentAccessRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/drawing", drawingRoutes);
    app.use("/api/drawing", drawingSettingsRoutes);
    app.use("/api/ai", aiLimiter, aiRoutes);
    app.use("/api/architecture", architectureRoutes);
    app.use("/api/grounding", groundingRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/organization", organizationRoutes);
    app.use("/api/search", searchRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/push", pushRoutes);
    app.use("/api/pieces", pieceRoutes);
    app.use("/api/icons", iconRoutes);
    app.use("/api/client-errors", clientErrorLimiter, clientErrorRoutes);
    app.use("/api/embed", embedRouter);
    app.use("/api/oembed", oembedRouter);
    app.use("/api/wall", createWallRouter());
    app.use("/api/activity", activityRoutes);
    app.use("/api/letters", letterRoutes);
    app.use("/api/oauth", authLimiter, oauthApiRouter);
    app.use("/.well-known", wellKnownRouter);
    app.use("/oauth", oauthRouter);
    app.use("/admin/dashboard", createOpsDashboardRouter({ collectMetrics: collectServerMetrics }));
    app.use("/mcp", createMcpRouter({ port }).router);

    app.use(errorHandler);
    return app;
};
