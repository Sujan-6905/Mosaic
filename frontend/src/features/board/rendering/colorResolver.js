import { colorTokenFor } from "../../../../../shared/canvas/color/colorTokens";

// Resolves a colour token against the active theme, cached so each token reads computed styles once.
// Elements with an exact colour never touch computed styles at all.
const TOKEN_TO_CSS_VAR = {
    "ink-primary": "--color-ink-primary",
    "ink-inverse": "--color-ink-inverse",
    "canvas-grid": "--color-canvas-grid",
    "bg-canvas": "--color-bg-canvas",
    "bg-sunken": "--color-bg-sunken",
    "bg-surface": "--color-bg-surface",
    "accent-muted": "--color-accent-muted",
    "selection-handle": "--color-canvas-selection-handle",
    "selection-fill": "--color-selection",
    danger: "--color-danger",
    "eraser-trail": "--color-eraser-trail",
};

let cache = { theme: null, values: {} };

const activeTheme = () => (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null);

const resolveToken = (token) => {
    const currentTheme = activeTheme();
    if (cache.theme !== currentTheme) {
        cache = { theme: currentTheme, values: {} };
    }
    if (token in cache.values) return cache.values[token];

    const cssVar = TOKEN_TO_CSS_VAR[token];
    // A server drawing a snapshot has no stylesheet; the element's literal colour stands.
    const resolved = cssVar && typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || null : null;
    cache.values[token] = resolved;
    return resolved;
};

// Literal hex elements bypass token resolution untouched: a colourToken
// only overrides when present and it actually resolves to something.
const resolveElementColor = (colorToken, literalColor) => {
    if (colorToken) {
        const resolved = resolveToken(colorToken);
        if (resolved) return resolved;
    }
    return literalColor;
};

// Called on each theme change, so the next resolution reads the new theme.
const invalidateColorCache = () => {
    cache = { theme: null, values: {} };
};

// A live var() for DOM styling, which the browser re-resolves on theme change, or the literal colour.
const elementColorStyle = (colorToken, literalColor) => {
    const cssVar = colorToken && TOKEN_TO_CSS_VAR[colorToken];
    return cssVar ? `var(${cssVar})` : literalColor;
};

// Same, but for swatch UI that only has a hex value in hand, not an
// element's already-resolved colorToken.
const swatchColorValue = (hexColor) => elementColorStyle(colorTokenFor(hexColor), hexColor);

export { resolveElementColor, invalidateColorCache, colorTokenFor, swatchColorValue, elementColorStyle };
