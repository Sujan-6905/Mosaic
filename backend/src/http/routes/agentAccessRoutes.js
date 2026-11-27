import { Router } from "express";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import validateBody from "../middlewares/validateBody.js";
import { sessionLimiter } from "../middlewares/rateLimiters.js";
import { createPersonalTokenSchema } from "../../validation/restSchemas.js";
import { listTokens, createToken, revokeToken, listAgents, disconnectAgent } from "../controllers/tokenController.js";

// Credentials for agents, managed only by the person themselves. Kept off the
// sign-in rate limit, which is sized for guessing passwords, not for Profile.
const router = Router();
router.get("/tokens", sessionLimiter, authCheck, humanOnly, listTokens);
router.post("/tokens", sessionLimiter, authCheck, humanOnly, validateBody(createPersonalTokenSchema), createToken);
router.delete("/tokens/:tokenId", sessionLimiter, authCheck, humanOnly, revokeToken);
router.get("/agents", sessionLimiter, authCheck, humanOnly, listAgents);
router.delete("/agents/:grantId", sessionLimiter, authCheck, humanOnly, disconnectAgent);

export default router;
