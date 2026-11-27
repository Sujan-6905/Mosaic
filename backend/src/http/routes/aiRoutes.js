import { Router } from "express";
import { runTurn } from "../controllers/aiController.js";
import { commitEditPreview, rebaseEditPreview, revertAppliedEditBatch, discardEditPreview, cancelEditTurn } from "../controllers/aiEditController.js";
import { listConversations, createConversation, getConversation, renameConversation, deleteConversation } from "../controllers/aiConversationController.js";
import { summarizeCatchUp } from "../controllers/catchUpController.js";
import authCheck from "../middlewares/authMiddleware.js";
import { checkEditAccess, checkViewAccess } from "../middlewares/checkAccess.js";
import validateBody from "../middlewares/validateBody.js";
import { aiTurnLimiter } from "../middlewares/rateLimiters.js";
import {
    aiTurnSchema,
    aiEditCommitSchema,
    aiEditRebaseSchema,
    aiCatchUpSummarySchema,
    aiEditRevertSchema,
    aiConversationCreateSchema,
    aiConversationRenameSchema,
} from "../../validation/restSchemas.js";

const router = Router();

router.post("/:shareId/turn", authCheck, aiTurnLimiter, checkEditAccess, validateBody(aiTurnSchema), runTurn);
router.post("/:shareId/edit/commit", authCheck, checkEditAccess, validateBody(aiEditCommitSchema), commitEditPreview);
router.post("/:shareId/catch-up/summary", authCheck, checkViewAccess, aiTurnLimiter, validateBody(aiCatchUpSummarySchema), summarizeCatchUp);
router.post("/:shareId/edit/rebase", authCheck, checkEditAccess, validateBody(aiEditRebaseSchema), rebaseEditPreview);
router.post("/:shareId/edit/revert", authCheck, checkEditAccess, validateBody(aiEditRevertSchema), revertAppliedEditBatch);
router.delete("/:shareId/edit/preview/:token", authCheck, checkEditAccess, discardEditPreview);
router.post("/:shareId/edit/cancel/:turnId", authCheck, checkEditAccess, cancelEditTurn);

router.get("/:shareId/conversations", authCheck, checkViewAccess, listConversations);
router.post("/:shareId/conversations", authCheck, checkEditAccess, validateBody(aiConversationCreateSchema), createConversation);
router.get("/:shareId/conversations/:conversationId", authCheck, checkViewAccess, getConversation);
router.patch("/:shareId/conversations/:conversationId", authCheck, checkViewAccess, validateBody(aiConversationRenameSchema), renameConversation);
router.delete("/:shareId/conversations/:conversationId", authCheck, checkViewAccess, deleteConversation);

export default router;
