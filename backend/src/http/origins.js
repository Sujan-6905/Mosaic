const trimSlash = (url) => url.trim().replace(/\/+$/, "");

// The frontend's public address: hosted MCP, OAuth metadata, embeds and links all name it.
export const appUrl = (env = process.env) => trimSlash(env.PUBLIC_APP_URL || "http://localhost:3000");

// Shared by the Express and Socket.io CORS setups, and never "*".
export const resolveCorsOrigins = (env = process.env) => (env.CORS_ORIGINS ? env.CORS_ORIGINS.split(",").map(trimSlash).filter(Boolean) : [appUrl(env)]);

// The app's own addresses, which an embed may never point back at.
export const ownOrigins = (env = process.env) => [...new Set([appUrl(env), ...resolveCorsOrigins(env)])];
