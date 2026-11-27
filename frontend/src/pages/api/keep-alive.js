import { isCronRequest, wakeBackendAndDatabase } from "@/lib/databaseKeepAlive";

export const config = { maxDuration: 300 };

// Called daily by the keep-alive schedule in vercel.json, which sends CRON_SECRET as a bearer token.
export default async function handler(req, res) {
    if (!isCronRequest(req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).end();
    const healthy = await wakeBackendAndDatabase(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL);
    if (!healthy) console.error("keep-alive: the backend never reported a healthy database");
    return res.status(healthy ? 200 : 502).json({ healthy });
}
