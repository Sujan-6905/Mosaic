import canvasStore, { redisClient } from "../liveRooms/canvasStore.js";
import { getIo } from "../realtime/ioRegistry.js";
import { getMetrics } from "./metrics.js";
import logger from "./logger.js";

// Parsed from INFO's raw text; null on failure so /metrics never fails because of it.
const getRedisMemoryBytes = async () => {
    if (!redisClient) return null;
    try {
        const info = await redisClient.info("memory");
        const match = info.match(/used_memory:(\d+)/);
        return match ? Number(match[1]) : null;
    } catch (error) {
        logger.warn({ err: error }, "failed to read redis memory usage");
        return null;
    }
};

export const collectServerMetrics = async () =>
    getMetrics({
        rooms: await canvasStore.getRoomCount(),
        sockets: getIo()?.engine.clientsCount ?? 0,
        roomOccupancy: await canvasStore.getTotalParticipantCount(),
        activeRooms: await canvasStore.getRoomOccupancySnapshot(),
        redisMemoryBytes: await getRedisMemoryBytes(),
    });
