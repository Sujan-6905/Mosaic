import { Router } from "express";
import { embedLimiter } from "../middlewares/rateLimiters.js";
import authCheck, { optionalAuth } from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import { policy, scene, embedSession, oembed } from "../controllers/embedController.js";

export const embedRouter = Router();
embedRouter.get("/:shareId/policy", embedLimiter, policy);
embedRouter.get("/:shareId/scene", embedLimiter, optionalAuth, scene);
embedRouter.post("/:shareId/session", authCheck, humanOnly, embedSession);

export const oembedRouter = Router();
oembedRouter.get("/", embedLimiter, oembed);
