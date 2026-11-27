import { Router } from "express";
import { getMe, register, login, oauthLogin, oauthComplete, checkUsername, changePassword, updateTheme } from "../controllers/authController.js";
import authCheck from "../middlewares/authMiddleware.js";
import { requireFrontendServer } from "../middlewares/frontendServer.js";
import humanOnly from "../middlewares/humanOnly.js";
import validateBody from "../middlewares/validateBody.js";
import { authLimiter, loginAccountLimiter, loginAccountCeiling, sessionLimiter, usernameCheckLimiter } from "../middlewares/rateLimiters.js";
import {
    registerSchema,
    loginSchema,
    oauthLoginSchema,
    oauthCompleteSchema,
    changePasswordSchema,
    updateThemeSchema,
    recoveryCodesSchema,
    recoverAccountSchema,
    deleteAccountSchema,
} from "../../validation/restSchemas.js";
import { createRecoveryCodes, recoverAccount, deleteAccount } from "../controllers/accountController.js";

const router = Router();

// Only routes that create an account or check a password spend the per-address sign-in budget.
router.post("/register", authLimiter, validateBody(registerSchema), register);
router.post("/login", authLimiter, validateBody(loginSchema), loginAccountCeiling, loginAccountLimiter, login);
// A recovery code is a password: the same per-account limits guard guessing it.
router.post("/recover", authLimiter, validateBody(recoverAccountSchema), loginAccountCeiling, loginAccountLimiter, recoverAccount);

// Provider sign-in: these trust an identity the provider vouched for, so only the Next.js
// server, holding the key, may call them.
router.post("/oauth-login", authLimiter, requireFrontendServer, validateBody(oauthLoginSchema), oauthLogin);
router.post("/oauth-complete", authLimiter, requireFrontendServer, validateBody(oauthCompleteSchema), oauthComplete);

router.get("/username-available/:username", usernameCheckLimiter, checkUsername);

// authCheck first so req.user is trustworthy before the body is even parsed.
router.get("/me", sessionLimiter, authCheck, getMe);
router.put("/password", authLimiter, authCheck, humanOnly, validateBody(changePasswordSchema), changePassword);
router.put("/theme", sessionLimiter, authCheck, validateBody(updateThemeSchema), updateTheme);
router.post("/recovery-codes", authLimiter, authCheck, humanOnly, validateBody(recoveryCodesSchema), createRecoveryCodes);
router.delete("/account", authLimiter, authCheck, humanOnly, validateBody(deleteAccountSchema), deleteAccount);

export default router;
