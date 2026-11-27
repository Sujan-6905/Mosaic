import { Router } from "express";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import validateBody from "../middlewares/validateBody.js";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "../../validation/pushSchemas.js";
import { getPublicKey, subscribe, unsubscribe } from "../controllers/pushController.js";

const router = Router();

router.get("/key", getPublicKey);
router.post("/subscriptions", authCheck, humanOnly, validateBody(pushSubscribeSchema), subscribe);
router.delete("/subscriptions", authCheck, humanOnly, validateBody(pushUnsubscribeSchema), unsubscribe);

export default router;
