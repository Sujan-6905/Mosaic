import { Router } from "express";
import { refresh, logout, endOthers } from "../controllers/sessionController.js";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import validateBody from "../middlewares/validateBody.js";
import { refreshTokenSchema } from "../../validation/restSchemas.js";

const router = Router();

// No authCheck: the refresh token is the credential, and the access token may already have lapsed.
router.post("/refresh", validateBody(refreshTokenSchema), refresh);
router.post("/end", validateBody(refreshTokenSchema), logout);
router.post("/end-others", authCheck, humanOnly, endOthers);

export default router;
