import { Router } from "express";
import authCheck from "../middlewares/authMiddleware.js";
import { getIconHandler, listIconSetsHandler, searchIconsHandler } from "../controllers/iconController.js";
import { iconLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.get("/sets", authCheck, listIconSetsHandler);
router.get("/search", authCheck, iconLimiter, searchIconsHandler);
router.get("/:set/:name", authCheck, iconLimiter, getIconHandler);

export default router;
