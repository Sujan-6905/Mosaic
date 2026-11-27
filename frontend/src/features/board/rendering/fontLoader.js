import { isValidFontSource } from "../../../../../shared/canvas/elements/fontSources";

const LOAD_TIMEOUT_MS = 10000;
const loads = new Map();

const withTimeout = (promise) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("The font took too long to load")), LOAD_TIMEOUT_MS))]);

const loadGoogleStylesheet = (url) =>
    new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.dataset.boardFont = "";
        link.onload = resolve;
        link.onerror = () => {
            link.remove();
            reject(new Error("Google Fonts has no font by that name"));
        };
        document.head.appendChild(link);
    });

const loadGoogleFont = async (family, url) => {
    await loadGoogleStylesheet(url);
    // The stylesheet only declares faces; the files download on first use.
    const faces = await document.fonts.load(`16px "${family}"`);
    if (faces.length === 0) throw new Error("Google Fonts has no font by that name");
    await document.fonts.load(`bold 16px "${family}"`).catch(() => {});
};

const loadFontFile = async (family, url) => {
    const face = new FontFace(family, `url("${url}")`);
    await face.load();
    document.fonts.add(face);
};

// Loads a board font once per page; every later call shares the same promise.
export const loadFontSource = (family, source) => {
    if (!isValidFontSource(source)) return Promise.reject(new Error("Unsupported font link"));
    if (!loads.has(source.url)) {
        const load = withTimeout(source.kind === "google" ? loadGoogleFont(family, source.url) : loadFontFile(family, source.url));
        loads.set(source.url, load);
    }
    return loads.get(source.url);
};

export const familyOf = (fontFamily) => (fontFamily || "").split(",")[0].replace(/['"]/g, "").trim();
