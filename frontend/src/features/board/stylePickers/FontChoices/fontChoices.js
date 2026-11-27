import { GOOGLE_FONT_PICKS } from "../../tools/toolSettings";
import { FONT_FAMILIES } from "../../../../../../shared/canvas/elements/fontSources.js";
import { fontFamilyStack, googleFontCssUrl, isValidFontSource } from "../../../../../../shared/canvas/elements/fontSources";

const SAVED_FONTS_KEY = "mosaic.boardFonts";
const MAX_SAVED_FONTS = 24;

export const fontLabel = (fontFamily) => (fontFamily || FONT_FAMILIES[0]).split(",")[0].replace(/['"]/g, "").trim();

const choice = (family, source) => ({ family, fontFamily: fontFamilyStack(family), source });

const readSavedFonts = () => {
    try {
        const saved = JSON.parse(window.localStorage.getItem(SAVED_FONTS_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter((font) => font?.family && isValidFontSource(font.source)) : [];
    } catch {
        return [];
    }
};

export const saveFont = (family, source) => {
    try {
        const rest = readSavedFonts().filter((font) => font.source.url !== source.url);
        window.localStorage.setItem(SAVED_FONTS_KEY, JSON.stringify([{ family, source }, ...rest].slice(0, MAX_SAVED_FONTS)));
    } catch {
        // Storage blocked: the font still applies, it just isn't remembered.
    }
};

// The groups a font menu shows. The element's own board font is listed even
// when this browser never saved it, so a collaborator's font stays pickable.
export const fontChoiceGroups = (current) => {
    const saved = readSavedFonts().map((font) => choice(font.family, font.source));
    const yours =
        current?.fontSource && !saved.some((font) => font.source.url === current.fontSource.url)
            ? [choice(fontLabel(current.fontFamily), current.fontSource), ...saved]
            : saved;
    const picks = GOOGLE_FONT_PICKS.filter((family) => !yours.some((font) => font.family === family)).map((family) =>
        choice(family, { kind: "google", url: googleFontCssUrl(family) }),
    );
    return [
        yours.length > 0 && { label: "Board fonts", choices: yours },
        { label: "Everywhere", choices: FONT_FAMILIES.map((fontFamily) => ({ family: fontLabel(fontFamily), fontFamily, source: null })) },
        { label: "Google Fonts", choices: picks },
    ].filter(Boolean);
};

export const isCurrentChoice = (fontChoice, current) =>
    fontChoice.source
        ? current?.fontSource?.url === fontChoice.source.url
        : !current?.fontSource && (current?.fontFamily || FONT_FAMILIES[0]) === fontChoice.fontFamily;
