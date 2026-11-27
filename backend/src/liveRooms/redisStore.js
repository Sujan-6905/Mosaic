import { mergeElementFields } from "./elementMerge.js";

// The same room state as memoryStore, in Redis, shared by every instance.
const ACTIVE_ROOMS_KEY = "canvas:active";
const DIRTY_BOARDS_KEY = "canvas:dirty";

const elementsKey = (shareId) => `canvas:${shareId}:elements`;
const versionsKey = (shareId) => `canvas:${shareId}:versions`;
const participantsKey = (shareId) => `canvas:${shareId}:participants`;
const backgroundKey = (shareId) => `canvas:${shareId}:background`;
const opSeqKey = (shareId) => `canvas:${shareId}:opSeq`;
const pendingOpsKey = (shareId) => `canvas:${shareId}:pendingOps`;
const activityKey = (shareId) => `canvas:${shareId}:activity`;
const votesKey = (shareId) => `canvas:${shareId}:votes`;

const createRedisStore = (redis) => ({
    async roomExists(shareId) {
        return (await redis.sismember(ACTIVE_ROOMS_KEY, shareId)) === 1;
    },

    // SADD's result is atomic across instances, which settles the create race.
    async createRoom(shareId) {
        const added = await redis.sadd(ACTIVE_ROOMS_KEY, shareId);
        return added === 1;
    },

    async deleteRoom(shareId) {
        await redis.srem(ACTIVE_ROOMS_KEY, shareId);
        await redis.srem(DIRTY_BOARDS_KEY, shareId);
        await redis.del(
            elementsKey(shareId),
            versionsKey(shareId),
            participantsKey(shareId),
            backgroundKey(shareId),
            opSeqKey(shareId),
            pendingOpsKey(shareId),
            activityKey(shareId),
            votesKey(shareId),
        );
    },

    async seedElements(shareId, elementsObj) {
        const entries = Object.entries(elementsObj || {});
        if (entries.length === 0) return;

        const elementsArgs = [];
        const versionsArgs = [];
        for (const [id, element] of entries) {
            elementsArgs.push(id, JSON.stringify(element));
            versionsArgs.push(id, String(element.version || 0));
        }

        await redis.hset(elementsKey(shareId), ...elementsArgs);
        await redis.hset(versionsKey(shareId), ...versionsArgs);
    },

    async getElements(shareId) {
        const raw = await redis.hgetall(elementsKey(shareId));
        const elements = {};
        for (const [id, json] of Object.entries(raw)) {
            elements[id] = JSON.parse(json);
        }
        return elements;
    },

    async getElement(shareId, elementId) {
        const json = await redis.hget(elementsKey(shareId), elementId);
        return json ? JSON.parse(json) : null;
    },

    // Atomic, so two instances stamping one element still get distinct, ordered versions.
    async setElement(shareId, elementId, elementData, userId) {
        const version = await redis.hincrby(versionsKey(shareId), elementId, 1);
        const element = { ...elementData, version, updatedBy: userId };
        await redis.hset(elementsKey(shareId), elementId, JSON.stringify(element));
        return { element, version };
    },

    // Not atomic across instances: two changes to one element within a round trip can still meet,
    // but a change that arrives after another has been stored keeps it.
    async setElementFields(shareId, elementId, elementData, fieldNames, userId) {
        const merged = mergeElementFields(await this.getElement(shareId, elementId), elementData, fieldNames);
        return this.setElement(shareId, elementId, merged, userId);
    },

    // The two commands are independent, so they go in one pipelined round trip.
    async deleteElement(shareId, elementId) {
        const [[, version]] = await redis.pipeline().hincrby(versionsKey(shareId), elementId, 1).hdel(elementsKey(shareId), elementId).exec();
        return { version };
    },

    async getParticipants(shareId) {
        const raw = await redis.hgetall(participantsKey(shareId));
        return Object.entries(raw).map(([socketId, json]) => ({
            socketId,
            ...JSON.parse(json),
        }));
    },

    async getParticipant(shareId, socketId) {
        const raw = await redis.hget(participantsKey(shareId), socketId);
        return raw ? JSON.parse(raw) : null;
    },

    async getParticipantCount(shareId) {
        return redis.hlen(participantsKey(shareId));
    },

    async addParticipant(shareId, socketId, participant) {
        await redis.hset(participantsKey(shareId), socketId, JSON.stringify(participant));
    },

    async removeParticipant(shareId, socketId) {
        await redis.hdel(participantsKey(shareId), socketId);
        return redis.hlen(participantsKey(shareId));
    },

    // A new room keeps the blank default.
    async seedBackground(shareId, background) {
        if (!background) return;
        await redis.set(backgroundKey(shareId), JSON.stringify(background));
    },

    async getBackground(shareId) {
        const raw = await redis.get(backgroundKey(shareId));
        return raw ? JSON.parse(raw) : { type: "blank", colorToken: null };
    },

    async setBackground(shareId, background) {
        await redis.set(backgroundKey(shareId), JSON.stringify(background));
        return background;
    },

    async getActivity(shareId, kind) {
        const raw = await redis.hget(activityKey(shareId), kind);
        return raw ? JSON.parse(raw) : null;
    },

    async setActivity(shareId, kind, value) {
        if (value === null) await redis.hdel(activityKey(shareId), kind);
        else await redis.hset(activityKey(shareId), kind, JSON.stringify(value));
        return value;
    },

    // One field per person, so people voting at once never overwrite each other.
    async setVotes(shareId, userId, elementIds) {
        await redis.hset(votesKey(shareId), userId, JSON.stringify(elementIds));
    },

    async getVotes(shareId) {
        const all = await redis.hgetall(votesKey(shareId));
        return Object.fromEntries(Object.entries(all ?? {}).map(([userId, raw]) => [userId, JSON.parse(raw)]));
    },

    async clearVotes(shareId) {
        await redis.del(votesKey(shareId));
    },

    async markDirty(shareId) {
        await redis.sadd(DIRTY_BOARDS_KEY, shareId);
    },

    // Atomic, so two instances' sweeps never flush the same board.
    async popDirty() {
        const shareId = await redis.spop(DIRTY_BOARDS_KEY);
        return shareId ?? null;
    },

    // INCR is Redis's atomic counter: two instances stamping an op at the
    // same instant still hand out two distinct, ordered sequence numbers.
    async nextOpSeq(shareId) {
        return redis.incr(opSeqKey(shareId));
    },

    // The board's current point, without minting a new seq.
    async currentOpSeq(shareId) {
        const raw = await redis.get(opSeqKey(shareId));
        return raw ? Number(raw) : 0;
    },

    // Re-seeded from the op log on rejoin, or a fresh key would collide with logged ops.
    async seedOpSeq(shareId, seq) {
        await redis.set(opSeqKey(shareId), seq);
    },

    async appendPendingOp(shareId, opRecord) {
        await redis.rpush(pendingOpsKey(shareId), JSON.stringify(opRecord));
    },

    async requeuePendingOps(shareId, opRecords) {
        if (opRecords.length === 0) return;
        await redis.lpush(pendingOpsKey(shareId), ...[...opRecords].reverse().map((op) => JSON.stringify(op)));
    },

    // One round trip; an op pushed between the read and the delete is picked up next drain.
    async drainPendingOps(shareId) {
        const key = pendingOpsKey(shareId);
        const [[, raw]] = await redis.multi().lrange(key, 0, -1).del(key).exec();
        return (raw || []).map((json) => JSON.parse(json));
    },

    // Lets temporal grouping read recent ops without taking them from the autosave sweep.
    async peekPendingOps(shareId) {
        const raw = await redis.lrange(pendingOpsKey(shareId), 0, -1);
        return raw.map((json) => JSON.parse(json));
    },

    async getRoomCount() {
        return redis.scard(ACTIVE_ROOMS_KEY);
    },

    // Summed over every room's participants hash, across all instances.
    async getTotalParticipantCount() {
        const shareIds = await redis.smembers(ACTIVE_ROOMS_KEY);
        if (shareIds.length === 0) return 0;
        const counts = await Promise.all(shareIds.map((shareId) => redis.hlen(participantsKey(shareId))));
        return counts.reduce((sum, count) => sum + count, 0);
    },

    async getRoomOccupancySnapshot() {
        const shareIds = await redis.smembers(ACTIVE_ROOMS_KEY);
        if (shareIds.length === 0) return [];
        const counts = await Promise.all(shareIds.map((shareId) => redis.hlen(participantsKey(shareId))));
        return shareIds.map((shareId, i) => ({ shareId, occupancy: counts[i] }));
    },
});

export default createRedisStore;
