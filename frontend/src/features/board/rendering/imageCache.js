// Loaded images by src for the whole tab. Drawing needs a loaded image, so callers draw a placeholder
// until `onLoaded` fires and they repaint.
const cache = new Map();

// { image: HTMLImageElement|null, status: "loading"|"loaded"|"error" }
export const getCachedImage = (src, onLoaded) => {
    if (!src) return { image: null, status: "error" };
    const existing = cache.get(src);
    if (existing) return existing;

    const entry = { image: null, status: "loading" };
    cache.set(src, entry);
    const img = new Image();
    img.onload = () => {
        entry.image = img;
        entry.status = "loaded";
        onLoaded?.();
    };
    img.onerror = () => {
        entry.status = "error";
        onLoaded?.();
    };
    img.src = src;
    return entry;
};
