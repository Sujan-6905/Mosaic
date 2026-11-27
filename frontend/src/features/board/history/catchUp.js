const KIND_VERBS = { added: "Added", edited: "Edited", moved: "Moved", removed: "Removed" };

export const CHANGE_KIND_COLORS = { added: "#22c55e", edited: "#f97316", moved: "#3b82f6", removed: "#ef4444" };

export const RANGES = [
    { value: "visit", label: "Last visit" },
    { value: "day", label: "24 hours" },
    { value: "week", label: "7 days" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Null means the server's own record of this person's last visit.
export const sinceForRange = (range, now = Date.now()) => {
    if (range === "day") return new Date(now - DAY_MS).toISOString();
    if (range === "week") return new Date(now - 7 * DAY_MS).toISOString();
    return null;
};

const listNames = (names) => {
    if (names.length <= 2) return names.join(" and ");
    return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length === 3 ? "" : "s"}`;
};

const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const describeCatchUp = (digest) => {
    const changeCount = digest.changes.length + digest.moreChangeCount;
    const commentCount = digest.comments.length + digest.moreCommentCount;
    const mentionCount = digest.comments.filter((comment) => comment.mentionsYou).length;
    const sentences = [];
    if (changeCount > 0) sentences.push(`${listNames(digest.people.map((person) => person.name))} made ${plural(changeCount, "change")}.`);
    if (commentCount > 0) {
        const mentions = mentionCount > 0 ? `, ${mentionCount} mentioning you` : "";
        sentences.push(`${plural(commentCount, "new comment")}${mentions}.`);
    }
    return sentences.join(" ");
};

export const boundsOfChanges = (changes) => {
    const present = changes.map((change) => change.bounds).filter(Boolean);
    if (present.length === 0) return null;
    return {
        minX: Math.min(...present.map((bounds) => bounds.minX)),
        minY: Math.min(...present.map((bounds) => bounds.minY)),
        maxX: Math.max(...present.map((bounds) => bounds.maxX)),
        maxY: Math.max(...present.map((bounds) => bounds.maxY)),
    };
};

export const describeChange = (change) => `${KIND_VERBS[change.kind]} ${change.name}`;

export const describeChangeAuthors = (change) => `${listNames(change.authorNames)}${change.viaAssistant ? " with the assistant" : ""}`;

export const describeSince = (sinceIso, now = Date.now()) => {
    const hours = Math.floor((now - new Date(sinceIso).getTime()) / (60 * 60 * 1000));
    if (hours < 1) return "In the last hour";
    if (hours < 48) return `In the last ${plural(hours, "hour")}`;
    return `In the last ${plural(Math.floor(hours / 24), "day")}`;
};
