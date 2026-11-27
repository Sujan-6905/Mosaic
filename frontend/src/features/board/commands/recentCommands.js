// Recently-run commands, persisted per browser: same "follow the user,
// not the board" reasoning as ColorPicker's recentColors.js.
const STORAGE_KEY = "mosaic:recentCommands";
const MAX_RECENTS = 5;

export const getRecentCommandIds = () => {
    if (typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const recordRecentCommand = (id) => {
    if (typeof window === "undefined") return [];
    const deduped = getRecentCommandIds().filter((existing) => existing !== id);
    const next = [id, ...deduped].slice(0, MAX_RECENTS);
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Recents are a convenience, not correctness: a full/disabled
        // localStorage (private browsing quota) just means they don't persist.
    }
    return next;
};
