import { isIP } from "node:net";

// Proxies in front of this server whose X-Forwarded-For entries are trusted; Vercel or one reverse proxy is one hop.
const trustedProxyHops = () => {
    const configured = Number(process.env.TRUST_PROXY);
    if (process.env.TRUST_PROXY !== undefined && Number.isInteger(configured) && configured >= 0) return configured;
    return process.env.NODE_ENV === "production" ? 1 : 0;
};

// The browser's address, read the way Express reads req.ip: walk back from the socket past each trusted hop.
export const clientIpOf = (req) => {
    const forwarded = String(req?.headers?.["x-forwarded-for"] ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    const chain = [...forwarded, req?.socket?.remoteAddress].filter(Boolean);
    const address = chain[Math.max(0, chain.length - 1 - trustedProxyHops())]?.replace(/^::ffff:/, "");
    return isIP(address ?? "") ? address : null;
};

// Calls from this server to the backend prove where they come from with the shared key, which is
// also what lets the backend believe the client address passed alongside it.
export const trustedServerHeaders = (clientIp) => ({
    headers: {
        "x-mosaic-server-key": process.env.FRONTEND_SERVER_KEY ?? "",
        ...(clientIp && { "x-mosaic-client-ip": clientIp }),
    },
});
