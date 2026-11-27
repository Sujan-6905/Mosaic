// Pure hex/RGB/HSV conversions backing the colour wheel: no DOM, no
// canvas context, unit-tested directly.

export const isValidHex = (value) => /^#?[0-9a-fA-F]{3}$/.test(value) || /^#?[0-9a-fA-F]{6}$/.test(value);

export const normalizeHex = (value) => {
    if (!value) return null;
    const trimmed = value.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
        return `#${trimmed
            .split("")
            .map((c) => c + c)
            .join("")
            .toLowerCase()}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
        return `#${trimmed.toLowerCase()}`;
    }
    return null;
};

export const hexToRgb = (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const int = parseInt(normalized.slice(1), 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};

export const rgbToHex = ({ r, g, b }) => {
    const toByte = (n) =>
        Math.max(0, Math.min(255, Math.round(n)))
            .toString(16)
            .padStart(2, "0");
    return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
};

export const rgbToHsv = ({ r, g, b }) => {
    const rn = r / 255,
        gn = g / 255,
        bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
        else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
        else h = 60 * ((rn - gn) / delta + 4);
    }
    if (h < 0) h += 360;

    return { h, s: max === 0 ? 0 : delta / max, v: max };
};

export const hsvToRgb = ({ h, s, v }) => {
    const c = v * s;
    const hp = (((h % 360) + 360) % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    const m = v - c;
    return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
};
