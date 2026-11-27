import { Router } from "express";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import { checkViewAccess, checkEditAccess, checkDeleteAccess } from "../middlewares/checkAccess.js";
import validateBody from "../middlewares/validateBody.js";
import { boardSettingsSchema } from "../../validation/restSchemas.js";
import { getSettings, updateSettings, getAgentActivity, undoTurn } from "../controllers/boardSettingsController.js";

const router = Router();

// Who besides collaborators may see the board, what agents may do on it, and where it may be embedded.
router.get("/:shareId/settings", authCheck, checkViewAccess, getSettings);
router.patch("/:shareId/settings", authCheck, humanOnly, checkDeleteAccess, validateBody(boardSettingsSchema), updateSettings);

router.get("/:shareId/agent-activity", authCheck, checkViewAccess, getAgentActivity);
router.post("/:shareId/agent-activity/:turnId/undo", authCheck, checkEditAccess, undoTurn);

export default router;
