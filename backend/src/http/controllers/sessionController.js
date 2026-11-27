import logger from "../../observability/logger.js";
import { refreshSession, endSession, endOtherSessions } from "../../auth/sessionTokens.js";
import { revokeAllPersonalTokens } from "../../auth/personalTokens.js";

const refresh = async (req, res) => {
    try {
        const pair = await refreshSession(req.body.refreshToken);
        if (!pair) return res.status(401).json({ message: "Your sign-in has ended. Sign in again.", code: "session_ended" });
        return res.status(200).json(pair);
    } catch (error) {
        logger.error({ err: error }, "error refreshing a session");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Always succeeds from the caller's side: signing out must never get stuck on the server.
const logout = async (req, res) => {
    try {
        await endSession(req.body.refreshToken);
    } catch (error) {
        logger.error({ err: error }, "error ending a session");
    }
    return res.status(204).end();
};

// "Sign out everywhere else": every sign-in but the caller's own ends, and every personal token with them.
const endOthers = async (req, res) => {
    try {
        const ended = await endOtherSessions(req.user.userId, { except: req.user.sid });
        const revokedTokens = await revokeAllPersonalTokens(req.user.userId);
        return res.status(200).json({ endedSessions: ended.length, revokedTokens });
    } catch (error) {
        logger.error({ err: error, userId: req.user.userId }, "error ending other sessions");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { refresh, logout, endOthers };
