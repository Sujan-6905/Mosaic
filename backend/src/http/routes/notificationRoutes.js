import { Router } from "express";
import { accessRequestLimiter } from "../middlewares/rateLimiters.js";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import validateBody from "../middlewares/validateBody.js";
import { notificationReadSchema } from "../../validation/restSchemas.js";
import { getNotifications, readNotifications, requestAccess } from "../controllers/notificationController.js";

const router = Router();

router.get("/", authCheck, humanOnly, getNotifications);
router.post("/read", authCheck, humanOnly, validateBody(notificationReadSchema), readNotifications);
router.post("/access-request/:shareId", authCheck, humanOnly, accessRequestLimiter, requestAccess);

export default router;
