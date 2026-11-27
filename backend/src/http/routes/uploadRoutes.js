import { Router } from "express";
import { getCloudinarySignature } from "../controllers/uploadController.js";
import authCheck from "../middlewares/authMiddleware.js";
import { uploadSignatureLimiter } from "../middlewares/rateLimiters.js";

const router = Router();

router.get("/cloudinary-signature", authCheck, uploadSignatureLimiter, getCloudinarySignature);

export default router;
