// Planned batches between preview and accept or reject. In memory: a lost plan just means asking again.
import { randomUUID } from "crypto";

const TTL_MS = 10 * 60 * 1000;
const store = new Map(); // token -> { shareId, userId, ops, baseElements, editableObjects, tainted, createdAt }

const isExpired = (entry) => Date.now() - entry.createdAt > TTL_MS;

const sweepExpired = () => {
    for (const [token, entry] of store.entries()) {
        if (isExpired(entry)) store.delete(token);
    }
};

export const savePlan = (plan) => {
    sweepExpired();
    const token = randomUUID();
    store.set(token, { ...plan, createdAt: Date.now() });
    return token;
};

// Resolves once, for the person who planned it, so a token can't commit twice.
export const consumePlan = (token, userId) => {
    const entry = store.get(token);
    if (!entry || isExpired(entry) || entry.userId !== userId) return null;
    store.delete(token);
    return entry;
};

// A commit that couldn't go through (the board moved under it, or the ticked
// operations don't stand alone) leaves the proposal open for another try.
export const restorePlan = (token, entry) => {
    store.set(token, entry);
};
