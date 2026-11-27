import { Router } from "express";
import authCheck from "../middlewares/authMiddleware.js";
import humanOnly from "../middlewares/humanOnly.js";
import validateBody from "../middlewares/validateBody.js";
import { checkDeleteAccess } from "../middlewares/checkAccess.js";
import { letterReadLimiter } from "../middlewares/rateLimiters.js";
import { createLetterSchema } from "../../validation/letterSchemas.js";
import { listBoardLetters, createLetter, revokeLetter, readLetter } from "../controllers/letterController.js";

const router = Router();

router.get("/board/:shareId", authCheck, humanOnly, checkDeleteAccess, listBoardLetters);
router.post("/board/:shareId", authCheck, humanOnly, checkDeleteAccess, validateBody(createLetterSchema), createLetter);
router.delete("/:token", authCheck, humanOnly, revokeLetter);
router.get("/:token", letterReadLimiter, readLetter);

export default router;
