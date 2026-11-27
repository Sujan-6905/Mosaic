// Per browser and keyed by userId, so two accounts sharing a browser never see each other's tour progress.
const keyFor = (userId) => `mosaic:completedTours:${userId}`;

export const getCompletedTours = (userId) => {
    if (typeof window === "undefined" || !userId) return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(keyFor(userId)) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const markTourCompleted = (userId, trackId) => {
    if (typeof window === "undefined" || !userId) return;
    const completed = new Set(getCompletedTours(userId));
    completed.add(trackId);
    try {
        window.localStorage.setItem(keyFor(userId), JSON.stringify([...completed]));
    } catch {
        // Completion tracking is a convenience, not correctness: a full/
        // disabled localStorage just means the tour may run again later.
    }
};

export const hasCompletedAnyTour = (userId) => getCompletedTours(userId).length > 0;
