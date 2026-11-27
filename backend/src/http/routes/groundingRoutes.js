import { Router } from "express";
import { getContext, resolve } from "../controllers/groundingController.js";
import { authCheckForReads } from "../middlewares/authMiddleware.js";
import { checkViewAccess } from "../middlewares/checkAccess.js";
import validateBody from "../middlewares/validateBody.js";
import { groundingContextSchema, groundingResolveSchema } from "../../validation/restSchemas.js";

const router = Router();

// Viewers may ask what's on a board and find things without changing anything.
router.post("/:shareId/context", authCheckForReads, checkViewAccess, validateBody(groundingContextSchema), getContext);
router.post("/:shareId/resolve", authCheckForReads, checkViewAccess, validateBody(groundingResolveSchema), resolve);

export default router;
