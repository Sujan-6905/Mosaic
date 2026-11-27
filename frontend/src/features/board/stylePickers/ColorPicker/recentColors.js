// Per browser rather than per board: these are the colours this person reaches for on any board.
const STORAGE_KEY = "mosaic:recentColors";
const MAX_RECENTS = 12;

export const getRecentColors = () => {
    if (typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const pushRecentColor = (hex) => {
    if (typeof window === "undefined") return [];
    const deduped = getRecentColors().filter((existing) => existing.toLowerCase() !== hex.toLowerCase());
    const next = [hex, ...deduped].slice(0, MAX_RECENTS);
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Recents are a convenience, not correctness: a full/disabled
        // localStorage (private browsing quota) just means they don't persist.
    }
    return next;
};
