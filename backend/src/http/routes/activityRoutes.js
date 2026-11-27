import { Router } from "express";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import { getActivityWall } from "../controllers/activityController.js";
// Registers the model so the collection is created at boot; the documents are written and read by key.
import "../../models/userActivitySchema.js";

const router = Router();

router.get("/wall", authCheck, humanOnly, getActivityWall);

export default router;
