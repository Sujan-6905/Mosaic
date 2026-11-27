import { Router } from "express";
import { createDrawing, getDrawings, getActivity, getDrawingById, updateDrawingTitle } from "../controllers/drawingController.js";
import { addCollaborator, removeCollaborator, updateCollaboratorRole, getCollaborator, searchInvitableUsers } from "../controllers/collaboratorController.js";
import { getVersionsHandler, previewVersionHandler, createVersionHandler, diffHandler } from "../controllers/historyController.js";
import { forkBoardHandler, getBranchesHandler, importDrawingHandler } from "../controllers/branchController.js";
import { getReplayReelHandler, getReplayTimelineHandler, getReplayWindowHandler } from "../controllers/replayController.js";
import { getCatchUp } from "../controllers/catchUpController.js";
import { applyMergeHandler, previewMergeHandler } from "../controllers/mergeController.js";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import { checkEditAccess, checkViewAccess, checkDeleteAccess, checkSweptOwner } from "../middlewares/checkAccess.js";
import { purgeDrawing, restoreDrawing, sweepDrawing } from "../controllers/sweepController.js";
import validateBody from "../middlewares/validateBody.js";
import {
    createDrawingSchema,
    updateDrawingTitleSchema,
    addCollaboratorSchema,
    removeCollaboratorSchema,
    updateCollaboratorRoleSchema,
    createVersionSchema,
    forkBoardSchema,
    importDrawingSchema,
    applyMergeSchema,
} from "../../validation/restSchemas.js";

const router = Router();

// update is done by socket by directly calling saveCanvasToDB
router.post("/create", authCheck, validateBody(createDrawingSchema), createDrawing);
router.get("/get", authCheck, getDrawings);
router.get("/activity", authCheck, getActivity);
router.get("/catch-up/:shareId", authCheck, checkViewAccess, getCatchUp);
router.get("/getById/:shareId", authCheck, getDrawingById);
// Deleting a board and choosing who reaches it take a person's full sign-in.
// A delete sweeps the board away; it can be put back until it is purged.
router.delete("/delete/:drawingId", authCheck, humanOnly, checkDeleteAccess, sweepDrawing);
router.post("/restore/:drawingId", authCheck, humanOnly, checkSweptOwner, restoreDrawing);
router.delete("/purge/:drawingId", authCheck, humanOnly, checkSweptOwner, purgeDrawing);
router.put("/update/:drawingId", authCheck, checkEditAccess, validateBody(updateDrawingTitleSchema), updateDrawingTitle);
router.get("/collaborators/:shareId", authCheck, getCollaborator);
router.get("/collaborators/:shareId/search", authCheck, humanOnly, checkDeleteAccess, searchInvitableUsers);
router.put("/collaborators/:shareId", authCheck, humanOnly, checkDeleteAccess, validateBody(addCollaboratorSchema), addCollaborator);
router.delete("/collaborators/:shareId", authCheck, humanOnly, checkDeleteAccess, validateBody(removeCollaboratorSchema), removeCollaborator);
router.patch("/collaborators/:shareId/role", authCheck, humanOnly, checkDeleteAccess, validateBody(updateCollaboratorRoleSchema), updateCollaboratorRole);

// Import into a brand-new board: merging into a board already open in a
// live room goes through the socket insert path instead (see socket.js).
router.post("/import", authCheck, validateBody(importDrawingSchema), importDrawingHandler);

router.get("/:shareId/versions", authCheck, checkViewAccess, getVersionsHandler);
router.get("/:shareId/versions/:seq/preview", authCheck, checkViewAccess, previewVersionHandler);
router.post("/:shareId/versions", authCheck, checkEditAccess, validateBody(createVersionSchema), createVersionHandler);
// View access, not edit: a Viewer may fork a board they can't edit.
router.post("/:shareId/fork", authCheck, checkViewAccess, validateBody(forkBoardSchema), forkBoardHandler);
router.get("/:shareId/branches", authCheck, checkViewAccess, getBranchesHandler);
router.get("/:shareId/diff", authCheck, checkViewAccess, diffHandler);
// Access is checked inside on both boards, since which one is changed depends on the direction.
router.get("/:shareId/merge", authCheck, previewMergeHandler);
router.post("/:shareId/merge", authCheck, validateBody(applyMergeSchema), applyMergeHandler);
router.get("/:shareId/replay/timeline", authCheck, checkViewAccess, getReplayTimelineHandler);
router.get("/:shareId/replay/window", authCheck, checkViewAccess, getReplayWindowHandler);
router.get("/:shareId/replay/reel", authCheck, checkViewAccess, getReplayReelHandler);

export default router;
