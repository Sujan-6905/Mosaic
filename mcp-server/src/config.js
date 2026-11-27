import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

const apiUrl = process.env.MOSAIC_API_URL || "http://localhost:5000";
const appUrl = process.env.MOSAIC_APP_URL || "http://localhost:3000";
const { MOSAIC_TOKEN, MOSAIC_USERNAME, MOSAIC_PASSWORD } = process.env;

if (!MOSAIC_TOKEN && !(MOSAIC_USERNAME && MOSAIC_PASSWORD)) {
    throw new Error("Set MOSAIC_TOKEN, or MOSAIC_USERNAME and MOSAIC_PASSWORD, in the environment or mcp-server/.env");
}

export const config = {
    apiUrl,
    appUrl,
    token: MOSAIC_TOKEN || null,
    username: MOSAIC_USERNAME || null,
    password: MOSAIC_PASSWORD || null,
};
