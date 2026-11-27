import jwt from "jsonwebtoken";
import logger from "../../observability/logger.js";
import { isSignInLive, JWT_ALGORITHM } from "../../auth/sessionTokens.js";
import { isPersonalToken, resolvePersonalToken } from "../../auth/personalTokens.js";

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });

// The caller behind a bearer token, or null. Shared by the REST check below and
// the Socket.io handshake, so both trust exactly the same tokens.
const resolveCredential = async (token) => {
    if (!token) return null;
    if (isPersonalToken(token)) return resolvePersonalToken(token);
    let claims;
    try {
        claims = verifyToken(token);
    } catch (error) {
        logger.warn({ err: error }, "jwt verification failed");
        return null;
    }
    if (claims.sid && !(await isSignInLive(claims.sid))) return null;
    return {
        userId: claims.userId,
        sid: claims.sid ?? null,
        scope: claims.scope ?? null,
        boards: claims.boards ?? null,
        agent: claims.agent ?? null,
    };
};

const bearerToken = (req) => {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    return scheme?.toLowerCase() === "bearer" ? token : null;
};

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Token refusals are 401s, which the client answers by renewing once. A read-only token
// may not write, except on routes whose POSTs only read (`readsOnly`).
const createAuthCheck =
    ({ readsOnly = false } = {}) =>
    async (req, res, next) => {
        const token = bearerToken(req);
        if (!token) return res.status(401).json({ message: "no token provided" });
        try {
            const principal = await resolveCredential(token);
            if (!principal) return res.status(401).json({ message: "invalid or expired token" });
            if (principal.scope === "read" && !readsOnly && !READ_METHODS.has(req.method)) {
                return res.status(403).json({ message: "This token can only read.", code: "read_only_token" });
            }
            req.user = principal;
            return next();
        } catch (error) {
            logger.error({ err: error }, "error checking a token");
            return res.status(500).json({ message: "Internal server error." });
        }
    };

const authCheck = createAuthCheck();

// For pages anyone may see but a signed-in person may see more of: a token is
// used when sent, and its absence or failure just means "not signed in".
const optionalAuth = async (req, res, next) => {
    try {
        req.user = await resolveCredential(bearerToken(req));
    } catch (error) {
        logger.error({ err: error }, "error checking an optional token");
        req.user = null;
    }
    return next();
};
const authCheckForReads = createAuthCheck({ readsOnly: true });

export default authCheck;
export { verifyToken, resolveCredential, bearerToken, authCheckForReads, optionalAuth };
