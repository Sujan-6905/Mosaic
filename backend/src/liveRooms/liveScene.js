// The live room's elements when a session is open, else the saved board: an agent can work on a
// board nobody has open. Callers sit behind the access checks.
import canvasStore from "./canvasStore.js";

export const isRoomLive = (shareId) => canvasStore.roomExists(shareId);

export const getLiveOrPersistedElements = async (shareId, persistedElements) => {
    const isLive = await isRoomLive(shareId);
    return isLive ? await canvasStore.getElements(shareId) : persistedElements || {};
};

export const getLiveOrPersistedScene = async (drawing) =>
    (await isRoomLive(drawing.shareId))
        ? { elements: await canvasStore.getElements(drawing.shareId), background: await canvasStore.getBackground(drawing.shareId) }
        : { elements: drawing.elements ?? {}, background: drawing.background };
