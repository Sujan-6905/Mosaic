import { Router } from "express";
import {
    addPieceHandler,
    createPieceSetHandler,
    deletePieceSetHandler,
    getSharedPieceSetHandler,
    installPieceSetHandler,
    listGalleryHandler,
    listPieceSetsHandler,
    removePieceHandler,
    updatePieceSetHandler,
} from "../controllers/pieceController.js";
import authCheck from "../middlewares/authMiddleware.js";
import validateBody from "../middlewares/validateBody.js";
import { galleryLimiter } from "../middlewares/rateLimiters.js";
import { createPieceSetSchema, newPieceSchema, updatePieceSetSchema } from "../../validation/pieceSchemas.js";

const router = Router();

router.get("/gallery", galleryLimiter, listGalleryHandler);
router.get("/", authCheck, listPieceSetsHandler);
router.post("/", authCheck, validateBody(createPieceSetSchema), createPieceSetHandler);
router.patch("/:setId", authCheck, validateBody(updatePieceSetSchema), updatePieceSetHandler);
router.delete("/:setId", authCheck, deletePieceSetHandler);
router.post("/:setId/pieces", authCheck, validateBody(newPieceSchema), addPieceHandler);
router.delete("/:setId/pieces/:pieceId", authCheck, removePieceHandler);
router.get("/shared/:setId", authCheck, getSharedPieceSetHandler);
router.post("/shared/:setId/install", authCheck, installPieceSetHandler);

export default router;
