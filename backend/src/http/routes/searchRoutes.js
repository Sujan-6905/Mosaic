import { Router } from "express";
import { searchBoardsHandler } from "../controllers/searchController.js";
import authCheck from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authCheck, searchBoardsHandler);

export default router;
