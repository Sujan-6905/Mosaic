// Fonts and images load only from the app's own uploads, so opening a board
// never sends its viewers' addresses to a site a collaborator picked.
const UPLOAD_HOST = "res.cloudinary.com";
const UPLOAD_FOLDER = "mosaic-boards";

// `resourceType` is Cloudinary's path segment: "image" for pictures, "raw" for font files.
// `cloudName`, where the caller knows the app's account, pins the URL to it.
export const isHostedUpload = (value, resourceType, { cloudName } = {}) => {
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== "https:" || url.hostname !== UPLOAD_HOST) return false;
    const match = url.pathname.match(new RegExp(`^/([A-Za-z0-9_-]+)/${resourceType}/upload/(?:v\\d+/)?${UPLOAD_FOLDER}/`));
    return Boolean(match) && (!cloudName || match[1] === cloudName);
};

const RASTER_SIGNATURES = [
    [0x89, 0x50, 0x4e, 0x47],
    [0xff, 0xd8, 0xff],
    [0x47, 0x49, 0x46, 0x38],
];

// PNG, JPEG, GIF or WebP, judged by the file's own first bytes rather than its name or headers.
export const isRasterImageBytes = (bytes) => {
    if (!bytes || bytes.length < 12) return false;
    const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    return isWebp || RASTER_SIGNATURES.some((signature) => signature.every((byte, index) => bytes[index] === byte));
};
