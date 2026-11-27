import canvasStore from "../liveRooms/canvasStore.js";
import { loadDataFromDB } from "./boards.js";
import { getLatestSeq } from "./operationLog.js";

// Opens a room from saved state, so a change made with no browser open takes the live path.
const ROOM_LOAD_ATTEMPTS = 2;

export const ensureRoomLoaded = async (shareId) => {
    for (let attempt = 1; ; attempt += 1) {
        if (!(await canvasStore.createRoom(shareId))) return;
        const savedData = await loadDataFromDB(shareId);
        try {
            await canvasStore.seedElements(shareId, savedData?.elements || {});
            await canvasStore.seedBackground(shareId, savedData?.background);
            // Continues the board's own op sequence rather than restarting it, which
            // would collide with history already logged for it.
            await canvasStore.seedOpSeq(shareId, await getLatestSeq(shareId));
            return;
        } catch (error) {
            // A room closing as its last person leaves can disappear between
            // creating and seeding; one more try opens a fresh one.
            if (attempt >= ROOM_LOAD_ATTEMPTS || (await canvasStore.roomExists(shareId))) throw error;
        }
    }
};

// A board's elements as they are now, without opening a room just to read them.
export const currentElements = async (shareId) => {
    if (await canvasStore.roomExists(shareId)) {
        try {
            return await canvasStore.getElements(shareId);
        } catch {
            // Closed while being read; what it saved on closing is current.
        }
    }
    return (await loadDataFromDB(shareId))?.elements || {};
};
