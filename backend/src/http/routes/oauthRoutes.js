import express, { Router } from "express";
import { protectedResource, authorizationServer, register, describeClient, approve, token } from "../controllers/oauthController.js";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import { authLimiter, sessionLimiter } from "../middlewares/rateLimiters.js";

// Discovery documents live at the site root; the frontend proxies these paths here.
export const wellKnownRouter = Router();
wellKnownRouter.get("/oauth-protected-resource", protectedResource);
wellKnownRouter.get("/oauth-protected-resource/mcp", protectedResource);
wellKnownRouter.get("/oauth-authorization-server", authorizationServer);

export const oauthRouter = Router();
oauthRouter.post("/register", authLimiter, register);
oauthRouter.post("/token", sessionLimiter, express.urlencoded({ extended: false }), token);

// Used by the consent screen, which the person reaches signed in to Mosaic.
export const oauthApiRouter = Router();
oauthApiRouter.get("/client", describeClient);
oauthApiRouter.post("/authorize", authCheck, humanOnly, approve);
