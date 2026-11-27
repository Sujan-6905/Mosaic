import { mergeElementFields } from "./elementMerge.js";

// Default store when REDIS_URL is unset: single-process, zero external
// deps. See canvasStore.js for the interface both implementations share.
const createMemoryStore = () => {
    const rooms = new Map(); // shareId -> { elements: Map, versions: Map, participants: Map }
    const dirtyBoards = new Set();
    const opSeqs = new Map(); // shareId -> number, board-wide op-log sequence
    const pendingOps = new Map(); // shareId -> opRecord[], drained by the autosave sweep

    const requireRoom = (shareId) => {
        const room = rooms.get(shareId);
        if (!room) throw new Error(`room ${shareId} does not exist`);
        return room;
    };

    return {
        async roomExists(shareId) {
            return rooms.has(shareId);
        },

        // No await between check and set, so this is atomic on Node's single thread.
        async createRoom(shareId) {
            if (rooms.has(shareId)) return false;
            rooms.set(shareId, {
                elements: new Map(),
                versions: new Map(),
                participants: new Map(),
                background: { type: "blank", colorToken: null },
                activity: new Map(),
                votes: new Map(),
            });
            return true;
        },

        async deleteRoom(shareId) {
            rooms.delete(shareId);
            dirtyBoards.delete(shareId);
            opSeqs.delete(shareId);
            pendingOps.delete(shareId);
        },

        async seedElements(shareId, elementsObj) {
            const room = requireRoom(shareId);
            for (const [id, element] of Object.entries(elementsObj || {})) {
                room.elements.set(id, element);
                room.versions.set(id, element.version || 0);
            }
        },

        async getElements(shareId) {
            const room = rooms.get(shareId);
            return room ? Object.fromEntries(room.elements) : {};
        },

        async getElement(shareId, elementId) {
            return rooms.get(shareId)?.elements.get(elementId) ?? null;
        },

        async setElement(shareId, elementId, elementData, userId) {
            const room = requireRoom(shareId);
            const version = (room.versions.get(elementId) ?? 0) + 1;
            room.versions.set(elementId, version);
            const element = { ...elementData, version, updatedBy: userId };
            room.elements.set(elementId, element);
            return { element, version };
        },

        // Read, merge and write with no await between them, so the merge is atomic on Node's single thread.
        async setElementFields(shareId, elementId, elementData, fieldNames, userId) {
            const room = requireRoom(shareId);
            const merged = mergeElementFields(room.elements.get(elementId), elementData, fieldNames);
            return this.setElement(shareId, elementId, merged, userId);
        },

        async deleteElement(shareId, elementId) {
            const room = requireRoom(shareId);
            const version = (room.versions.get(elementId) ?? 0) + 1;
            room.versions.set(elementId, version);
            room.elements.delete(elementId);
            return { version };
        },

        async getParticipants(shareId) {
            const room = rooms.get(shareId);
            if (!room) return [];
            return Array.from(room.participants.entries()).map(([socketId, participant]) => ({
                socketId,
                ...participant,
            }));
        },

        async getParticipant(shareId, socketId) {
            return rooms.get(shareId)?.participants.get(socketId) ?? null;
        },

        async getParticipantCount(shareId) {
            return rooms.get(shareId)?.participants.size ?? 0;
        },

        async addParticipant(shareId, socketId, participant) {
            requireRoom(shareId).participants.set(socketId, participant);
        },

        async removeParticipant(shareId, socketId) {
            const room = rooms.get(shareId);
            if (!room) return 0;
            room.participants.delete(socketId);
            return room.participants.size;
        },

        // Only overwrites when a persisted value exists: a brand-new room
        // (nothing saved yet) keeps the blank default createRoom already set.
        async seedBackground(shareId, background) {
            if (!background) return;
            requireRoom(shareId).background = background;
        },

        async getBackground(shareId) {
            return rooms.get(shareId)?.background ?? { type: "blank", colorToken: null };
        },

        async setBackground(shareId, background) {
            requireRoom(shareId).background = background;
            return background;
        },

        async getActivity(shareId, kind) {
            return rooms.get(shareId)?.activity.get(kind) ?? null;
        },

        async setActivity(shareId, kind, value) {
            const { activity } = requireRoom(shareId);
            if (value === null) activity.delete(kind);
            else activity.set(kind, value);
            return value;
        },

        async setVotes(shareId, userId, elementIds) {
            requireRoom(shareId).votes.set(userId, elementIds);
        },

        async getVotes(shareId) {
            return Object.fromEntries(rooms.get(shareId)?.votes ?? []);
        },

        async clearVotes(shareId) {
            rooms.get(shareId)?.votes.clear();
        },

        async markDirty(shareId) {
            dirtyBoards.add(shareId);
        },

        // Drains one board per call so the autosave sweep can loop until empty,
        // mirroring redisStore's SPOP semantics exactly.
        async popDirty() {
            const [shareId] = dirtyBoards;
            if (shareId === undefined) return null;
            dirtyBoards.delete(shareId);
            return shareId;
        },

        // One ordered stream per board for the op log, unlike per-element versions.
        async nextOpSeq(shareId) {
            const seq = (opSeqs.get(shareId) ?? 0) + 1;
            opSeqs.set(shareId, seq);
            return seq;
        },

        // The board's current point, without minting a new seq.
        async currentOpSeq(shareId) {
            return opSeqs.get(shareId) ?? 0;
        },

        // Re-seeded from the op log on rejoin, or a fresh counter would collide with logged ops.
        async seedOpSeq(shareId, seq) {
            opSeqs.set(shareId, seq);
        },

        async appendPendingOp(shareId, opRecord) {
            const buffer = pendingOps.get(shareId);
            if (buffer) buffer.push(opRecord);
            else pendingOps.set(shareId, [opRecord]);
        },

        async requeuePendingOps(shareId, opRecords) {
            pendingOps.set(shareId, [...opRecords, ...(pendingOps.get(shareId) || [])]);
        },

        async drainPendingOps(shareId) {
            const buffer = pendingOps.get(shareId);
            if (!buffer || buffer.length === 0) return [];
            pendingOps.set(shareId, []);
            return buffer;
        },

        // Lets temporal grouping read recent ops without taking them from the autosave sweep.
        async peekPendingOps(shareId) {
            return [...(pendingOps.get(shareId) || [])];
        },

        async getRoomCount() {
            return rooms.size;
        },

        async getTotalParticipantCount() {
            let total = 0;
            for (const room of rooms.values()) total += room.participants.size;
            return total;
        },

        async getRoomOccupancySnapshot() {
            return Array.from(rooms.entries()).map(([shareId, room]) => ({
                shareId,
                occupancy: room.participants.size,
            }));
        },
    };
};

export default createMemoryStore;
