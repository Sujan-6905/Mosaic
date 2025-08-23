import { Router } from "express";
import {
    register,
    login,
    oauthLogin,      // NEW controller
    updateProfile,
    changePassword,
} from "../controllers/authController.js";

const router = Router();

// Credentials-based registration/login
router.post("/register", register);
router.post("/login", login);

// OAuth-based login (Google, GitHub, etc.)
router.post("/oauth-login", oauthLogin);  // NEW route

// Profile management
router.put("/update", updateProfile);
router.put("/password", changePassword);

export default router;

