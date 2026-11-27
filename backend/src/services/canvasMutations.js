// The one write path for live and agent edits: store write, broadcast, dirty mark and op-log
// append, in that order.
import { appendOp } from "./operationLog.js";
import { recordOp, recordRoomOp } from "../observability/metrics.js";
import { boardAndWatchers } from "../realtime/roomNames.js";

export const applyElementUpsert = async (
    { shareId, elementId, element, operation, changedFields, authorId, authorName, agentId = null, correlationId = null },
    { io, canvasStore },
) => {
    // The store stamps the version, never the caller. A named-field update wins per field.
    const { element: stamped } = changedFields
        ? await canvasStore.setElementFields(shareId, elementId, element, changedFields, authorId)
        : await canvasStore.setElement(shareId, elementId, element, authorId);
    const eventName = operation === "update" ? "server:updateElement" : "server:addNewElement";
    io.to(boardAndWatchers(shareId)).emit(eventName, { elementId, element: stamped });
    await canvasStore.markDirty(shareId);
    await appendOp({
        shareId,
        opType: operation === "update" ? "update" : "insert",
        elementId,
        after: stamped,
        authorId,
        authorName,
        agentId,
        correlationId,
    });
    recordOp();
    recordRoomOp(shareId);
    return stamped;
};

export const applyElementDelete = async ({ shareId, elementId, authorId, authorName, agentId = null, correlationId = null }, { io, canvasStore }) => {
    const { version } = await canvasStore.deleteElement(shareId, elementId);
    io.to(boardAndWatchers(shareId)).emit("server:deleteElement", { elementId, version });
    await canvasStore.markDirty(shareId);
    await appendOp({ shareId, opType: "delete", elementId, after: null, authorId, authorName, agentId, correlationId });
    recordOp();
    recordRoomOp(shareId);
    return { version };
};
