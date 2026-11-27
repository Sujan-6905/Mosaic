import { Router } from "express";
import { createHostedMcp } from "../../../../mcp-server/src/hosted.js";
import { resolveCredential, bearerToken } from "../middlewares/authMiddleware.js";
import { appUrl } from "../origins.js";
import logger from "../../observability/logger.js";

// Hosted MCP: the agent's tools call back over loopback with its own token, so every edit
// passes the same checks as a person's.
export const createMcpRouter = ({ port }) => {
    const hosted = createHostedMcp({ apiUrl: `http://127.0.0.1:${port}`, appUrl: appUrl() });
    const router = Router();

    // An agent app reads this header to find where to send the person to sign in.
    const challenge = (res) => {
        res.set("WWW-Authenticate", `Bearer resource_metadata="${appUrl()}/.well-known/oauth-protected-resource/mcp"`);
        return res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Sign in to Mosaic to use this server." }, id: null });
    };

    router.all("/", async (req, res) => {
        const token = bearerToken(req);
        try {
            const principal = token ? await resolveCredential(token) : null;
            if (!principal) return challenge(res);
            return await hosted.handle(req, res, { principal, token });
        } catch (error) {
            logger.error({ err: error }, "hosted mcp request failed");
            if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error." }, id: null });
        }
    });

    return { router, shutdown: hosted.shutdown };
};
