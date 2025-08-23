import { Router } from "express";
import {
    createDrawing,
    getDrawings,
    getDrawingById,
    deleteDrawing,
    updateDrawingTitle,
    addCollaborator,
    removeCollaborator,
    getCollaborator,
} from "../controllers/drawingController.js";
import authCheck from "../middlewares/authMiddleware.js";
import { checkDeleteAccess } from "../middlewares/checkAccess.js";

const router = Router();

// update is done by socket by directly calling saveCanvasToDB
router.post("/create", authCheck, createDrawing);
router.get("/get", authCheck, getDrawings);
router.get("/getById/:shareId", authCheck, getDrawingById);
router.delete(
    "/delete/:drawingId",
    authCheck,
    checkDeleteAccess,
    deleteDrawing,
);
router.put("/update/:drawingId", authCheck, updateDrawingTitle); // may need to check for ownership? We already have one which is checkDeleteAccess but the name is not very conventional
router.get("/collaborators/:shareId", authCheck, getCollaborator);
router.put("/collaborators/:shareId", authCheck, checkDeleteAccess, addCollaborator);
router.delete("/collaborators/:shareId", authCheck, checkDeleteAccess, removeCollaborator);

export default router;
