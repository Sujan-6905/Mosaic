// WCAG relative luminance and contrast ratio.
const srgbToLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const hexToRgb = (hex) => {
    const normalized = hex.replace("#", "");
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
};

const relativeLuminance = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
};

export const contrastRatio = (hexA, hexB) => {
    const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
    const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
    return (lighter + 0.05) / (darker + 0.05);
};

// WCAG AA for normal-size text.
export const WCAG_AA_NORMAL_TEXT = 4.5;
