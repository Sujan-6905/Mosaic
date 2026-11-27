import { isIP } from "node:net";
import { secretsMatch } from "../../auth/secretsMatch.js";

// True only for the Next.js server, which proves itself with the key it shares with this one.
const isFromFrontendServer = (req) => secretsMatch(req.get("x-mosaic-server-key"), process.env.FRONTEND_SERVER_KEY);

// Social sign-in trusts an identity next-auth verified, which a browser must never be able to choose.
export const requireFrontendServer = (req, res, next) => {
    if (!process.env.FRONTEND_SERVER_KEY) return res.status(503).json({ message: "Social sign-in isn't set up on this server." });
    if (!isFromFrontendServer(req)) return res.status(403).json({ message: "Forbidden" });
    return next();
};

// Sign-in and token renewal reach this server from the Next.js server, so the person's own address arrives in a
// header that counts only when the shared key does; everything else uses the address Express trusts.
export const resolveClientIp = (req, res, next) => {
    const vouched = req.get("x-mosaic-client-ip");
    req.clientIp = vouched && isIP(vouched) && isFromFrontendServer(req) ? vouched : req.ip;
    next();
};
