import { Router } from "express";
import { redisClient } from "../../liveRooms/canvasStore.js";
import { checkDbHealth, checkRedisHealth } from "../../observability/health.js";
import { collectServerMetrics } from "../../observability/serverMetrics.js";

const router = Router();

router.get("/", (req, res) => res.status(200).json({ service: "mosaic-backend", health: "/healthz" }));

// Public: the client hides AI and upload features a deployment hasn't configured.
router.get("/api/config", (req, res) =>
    res.status(200).json({
        aiEnabled: Boolean(process.env.GROQ_API_KEY),
        imageUploadEnabled: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    }),
);

// Public and unthrottled, as the host's wake probe. Checks Redis only when REDIS_URL is set.
router.get("/healthz", async (req, res) => {
    const db = await checkDbHealth();
    const redis = redisClient ? await checkRedisHealth(redisClient) : null;
    const healthy = db.healthy && (redis === null || redis.healthy);
    return res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", db, ...(redis && { redis }) });
});

// Public counters only: the per-board breakdown names share ids, which open link-shared boards.
router.get("/metrics", async (req, res) => {
    const { activeRooms, ...counters } = await collectServerMetrics();
    return res.status(200).json(counters);
});

export default router;
