import { Router } from "express";
import { importRepository, getRepositoryLink, syncRepository, compareRepository } from "../controllers/architectureController.js";
import authCheck from "../middlewares/authMiddleware.js";
import { checkEditAccess, checkViewAccess } from "../middlewares/checkAccess.js";
import validateBody from "../middlewares/validateBody.js";
import { architectureLimiter } from "../middlewares/rateLimiters.js";
import { architectureImportSchema, architectureCompareSchema } from "../../validation/restSchemas.js";

const router = Router();

router.get("/:shareId", authCheck, checkViewAccess, getRepositoryLink);
router.post("/:shareId/import", authCheck, checkEditAccess, architectureLimiter, validateBody(architectureImportSchema), importRepository);
router.post("/:shareId/sync", authCheck, checkEditAccess, architectureLimiter, syncRepository);
router.post("/:shareId/compare", authCheck, checkViewAccess, architectureLimiter, validateBody(architectureCompareSchema), compareRepository);

export default router;
