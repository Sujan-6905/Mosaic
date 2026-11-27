// One id per tab session: sessionStorage survives a refresh but is per tab, so an incident is one id to grep for.
const STORAGE_KEY = "mosaic:correlationId";

let cached = null;

export const getCorrelationId = () => {
    if (cached) return cached;
    if (typeof window === "undefined") return null;

    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
        cached = stored;
        return cached;
    }

    cached = crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, cached);
    return cached;
};
