import { Router } from "express";
import {
    getCategoriesHandler,
    createCategoryHandler,
    updateCategoryHandler,
    deleteCategoryHandler,
    getBoardOrganizationHandler,
    setBoardOrganizationHandler,
} from "../controllers/organizationController.js";
import authCheck from "../middlewares/authMiddleware.js";
import validateBody from "../middlewares/validateBody.js";
import { createCategorySchema, updateCategorySchema, setBoardOrganizationSchema } from "../../validation/restSchemas.js";

const router = Router();

router.get("/categories", authCheck, getCategoriesHandler);
router.post("/categories", authCheck, validateBody(createCategorySchema), createCategoryHandler);
router.patch("/categories/:categoryId", authCheck, validateBody(updateCategorySchema), updateCategoryHandler);
router.delete("/categories/:categoryId", authCheck, deleteCategoryHandler);

router.get("/boards/:shareId", authCheck, getBoardOrganizationHandler);
router.put("/boards/:shareId", authCheck, validateBody(setBoardOrganizationSchema), setBoardOrganizationHandler);

export default router;
