import { Router } from "express";
import { reportClientError } from "../controllers/clientErrorController.js";
import validateBody from "../middlewares/validateBody.js";
import { clientErrorSchema } from "../../validation/restSchemas.js";

const router = Router();

router.post("/", validateBody(clientErrorSchema), reportClientError);

export default router;
