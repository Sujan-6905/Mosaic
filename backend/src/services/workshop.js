import { MAX_TIMER_MS } from "../validation/workshopSchemas.js";

const EXTEND_MS = 60 * 1000;

// A board's shared countdown. While running it carries the moment it ends; while
// paused, the time it had left. Every change returns the next state, or null for none.
export const nextTimer = (timer, request, now, startedByName) => {
    if (request.action === "start") {
        return { durationMs: request.durationMs, running: true, endsAt: now + request.durationMs, remainingMs: request.durationMs, startedByName };
    }
    if (!timer || request.action === "reset") return null;
    if (request.action === "pause" && timer.running) {
        return { ...timer, running: false, endsAt: null, remainingMs: Math.max(0, timer.endsAt - now) };
    }
    if (request.action === "resume" && !timer.running && timer.remainingMs > 0) {
        return { ...timer, running: true, endsAt: now + timer.remainingMs };
    }
    if (request.action === "extend") {
        const left = timer.running ? Math.max(0, timer.endsAt - now) : timer.remainingMs;
        const remainingMs = Math.min(MAX_TIMER_MS, left + EXTEND_MS);
        return { ...timer, durationMs: Math.min(MAX_TIMER_MS, timer.durationMs + EXTEND_MS), remainingMs, running: true, endsAt: now + remainingMs };
    }
    return timer;
};

// One person's votes after placing or taking back one on an element.
export const nextVotes = (mine, elementId, add, votesPerPerson) => {
    if (add) return mine.length < votesPerPerson ? [...mine, elementId] : null;
    const at = mine.lastIndexOf(elementId);
    return at === -1 ? null : [...mine.slice(0, at), ...mine.slice(at + 1)];
};

// Votes per element, most first, for the reveal.
export const tallyVotes = (votesByUser) => {
    const counts = new Map();
    Object.values(votesByUser)
        .flat()
        .forEach((elementId) => counts.set(elementId, (counts.get(elementId) ?? 0) + 1));
    return [...counts].map(([elementId, count]) => ({ elementId, count })).sort((a, b) => b.count - a.count);
};

// What everyone may see of a vote: while it is open, how many have voted but never for what.
export const publicVoting = (voting, votesByUser) => {
    if (!voting) return null;
    const voters = Object.values(votesByUser).filter((ids) => ids.length > 0);
    return {
        status: voting.status,
        votesPerPerson: voting.votesPerPerson,
        startedByName: voting.startedByName,
        voterCount: voters.length,
        results: voting.status === "closed" ? voting.results : null,
    };
};
