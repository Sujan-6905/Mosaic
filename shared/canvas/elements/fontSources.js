import { isHostedUpload } from "./hostedUploads.js";

// Installed on every OS. Any other font travels with its element as a fontSource:
// a Google Fonts family or a direct font file.
export const FONT_FAMILIES = [
    "Arial, sans-serif",
    "'Helvetica Neue', Helvetica, Arial, sans-serif",
    "Verdana, sans-serif",
    "Tahoma, sans-serif",
    "'Segoe UI', sans-serif",
    "'Trebuchet MS', sans-serif",
    "Georgia, serif",
    "'Times New Roman', serif",
    "'Palatino Linotype', Palatino, serif",
    "'Courier New', monospace",
    "'Comic Sans MS', cursive",
    "Impact, fantasy",
];

export const FONT_SOURCE_KINDS = ["google", "file"];

const GOOGLE_CSS_PREFIXES = ["https://fonts.googleapis.com/css2?", "https://fonts.googleapis.com/css?"];
const FONT_FILE_PATTERN = /\.(woff2|woff|ttf|otf)$/i;
// Nothing that could close a CSS url("...") or an attribute it is written into.
const SAFE_URL_PATTERN = /^[^\s"'<>\\(){}`\u0000-\u001f]+$/;
const FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,62}$/;
const MAX_FONT_URL_LENGTH = 600;

export const isValidFontFamilyName = (family) => typeof family === "string" && FAMILY_PATTERN.test(family.trim());

const parseHttpsUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url : null;
    } catch {
        return null;
    }
};

export const googleFontCssUrl = (family) =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim()).replace(/%20/g, "+")}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;

const isSafeHttpsUrl = (value) =>
    typeof value === "string" && value.length <= MAX_FONT_URL_LENGTH && SAFE_URL_PATTERN.test(value) && Boolean(parseHttpsUrl(value));

// `cloudName`, where the caller knows the app's Cloudinary account, pins file
// sources to that account rather than any account's upload folder.
export const isValidFontSource = (source, { cloudName } = {}) => {
    if (!source || !isSafeHttpsUrl(source.url)) return false;
    if (source.kind === "google") return GOOGLE_CSS_PREFIXES.some((prefix) => source.url.startsWith(prefix));
    if (source.kind === "file") return isHostedUpload(source.url, "raw", { cloudName });
    return false;
};

const familyFromGoogleCss = (url) => {
    const raw = url.searchParams.get("family");
    return raw ? raw.split("|")[0].split(":")[0].replace(/\+/g, " ").trim() : null;
};

const familyFromFileName = (url) =>
    decodeURIComponent(url.pathname.split("/").pop() || "")
        .replace(FONT_FILE_PATTERN, "")
        .replace(/[^A-Za-z0-9 _-]+/g, " ")
        .replace(/[-_]+/g, " ")
        .trim()
        .slice(0, 63);

// Accepts a Google Fonts name, specimen page or stylesheet link, or a direct font file link.
// A file hosted elsewhere returns as `fileLink`, to be copied into the app's uploads first.
export const parseFontInput = (input, name) => {
    const text = (input || "").trim();
    if (!text) return { error: "Enter a font name or a link" };
    const url = parseHttpsUrl(text);
    if (!url) {
        if (/^[a-z]+:/i.test(text)) return { error: "Only https links are supported" };
        if (!isValidFontFamilyName(text)) return { error: "Font names use letters, numbers, spaces and dashes" };
        return { family: text, source: { kind: "google", url: googleFontCssUrl(text) } };
    }
    if (url.hostname === "fonts.google.com") {
        const match = url.pathname.match(/\/specimen\/([^/]+)/);
        if (!match) return { error: "Open the font's own page on Google Fonts and paste that link" };
        const family = decodeURIComponent(match[1]).replace(/\+/g, " ");
        return isValidFontFamilyName(family)
            ? { family, source: { kind: "google", url: googleFontCssUrl(family) } }
            : { error: "That font name isn't supported" };
    }
    if (url.hostname === "fonts.googleapis.com") {
        const family = familyFromGoogleCss(url);
        if (!family || !isValidFontFamilyName(family)) return { error: "That Google Fonts link has no family in it" };
        const source = { kind: "google", url: text };
        return isValidFontSource(source) ? { family, source } : { error: "That Google Fonts link isn't supported" };
    }
    const hosted = { kind: "file", url: text };
    if (!isValidFontSource(hosted) && !(isSafeHttpsUrl(text) && FONT_FILE_PATTERN.test(url.pathname)))
        return { error: "Link to a .woff2, .woff, .ttf or .otf file" };
    const family = (name || "").trim() || familyFromFileName(url);
    if (!isValidFontFamilyName(family)) return { error: "Give the font a name using letters, numbers and spaces" };
    return isValidFontSource(hosted) ? { family, source: hosted } : { family, fileLink: text };
};

const FONT_SIGNATURES = ["wOF2", "wOFF", "OTTO", "true", "ttcf", "\u0000\u0001\u0000\u0000"];

// Whether bytes really are a WOFF2, WOFF, OpenType or TrueType file, judged
// by their first four bytes rather than by what the link or server claims.
export const isFontFileBytes = (bytes) => bytes?.length >= 4 && FONT_SIGNATURES.includes(String.fromCharCode(...bytes.slice(0, 4)));

// The CSS family stack an element stores, with a fallback while the font loads.
export const fontFamilyStack = (family) => `'${family}', sans-serif`;

const webSafeFamilyNamed = (name) => FONT_FAMILIES.find((family) => family.split(",")[0].replace(/'/g, "").toLowerCase() === name.trim().toLowerCase());

// A file link that still needs copying into the app's uploads comes back as `fileLink`.
export const fontFieldsFor = (input) => {
    const webSafe = webSafeFamilyNamed(input || "");
    if (webSafe) return { fontFamily: webSafe, fontSource: null };
    const parsed = parseFontInput(input);
    if (parsed.error) return parsed;
    if (parsed.fileLink) return { fontFamily: fontFamilyStack(parsed.family), fileLink: parsed.fileLink };
    return { fontFamily: fontFamilyStack(parsed.family), fontSource: parsed.source };
};
