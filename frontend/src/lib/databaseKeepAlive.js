import { createHash, timingSafeEqual } from "node:crypto";

const ATTEMPT_TIMEOUT_MS = 60_000;
const RETRY_MS = 10_000;
// Inside the route's maxDuration, so a failure is reported rather than cut off.
const GIVE_UP_AFTER_MS = 270_000;

const digest = (value) => createHash("sha256").update(value).digest();

export const isCronRequest = (authorization, secret) => Boolean(secret) && timingSafeEqual(digest(authorization ?? ""), digest(`Bearer ${secret}`));

// A sleeping host can answer with a loading page, so only the backend's own "ok" counts.
const reportsHealthy = async (url) => {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS), cache: "no-store" });
        return response.ok && (await response.json()).status === "ok";
    } catch {
        return false;
    }
};

// /healthz reads from the database, which is what keeps a free cluster from idling out.
export const wakeBackendAndDatabase = async (backendUrl) => {
    const url = `${backendUrl.replace(/\/$/, "")}/healthz`;
    const deadline = Date.now() + GIVE_UP_AFTER_MS;
    while (!(await reportsHealthy(url))) {
        if (Date.now() + RETRY_MS >= deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
    return true;
};
