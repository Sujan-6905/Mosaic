// Caches a live room's grounded scene keyed by its op seq, so repeated calls on an unchanged board reuse it.
// Saved boards have no seq to track, and viewport-scoped scenes differ per caller, so neither is cached.
import canvasStore from "../liveRooms/canvasStore.js";
import { buildGroundedScene } from "./buildGroundedScene.js";
import { isRoomLive } from "../liveRooms/liveScene.js";
import { scopeElementsToViewport } from "./viewportScope.js";

const cache = new Map(); // shareId -> { seq, scene }

// With a viewport, a board past the size threshold is grounded only around what the caller can see.
export const getGroundedScene = async (shareId, elements, viewport = null) => {
    const scoped = scopeElementsToViewport(elements, viewport);
    if (scoped.partial) return { ...(await buildGroundedScene(shareId, scoped.elements)), partial: true };

    if (!(await isRoomLive(shareId))) return buildGroundedScene(shareId, elements);

    const seq = await canvasStore.currentOpSeq(shareId);
    const cached = cache.get(shareId);
    if (cached && cached.seq === seq) return cached.scene;

    const scene = await buildGroundedScene(shareId, elements);
    cache.set(shareId, { seq, scene });
    return scene;
};

export const invalidateGroundedScene = (shareId) => cache.delete(shareId);
