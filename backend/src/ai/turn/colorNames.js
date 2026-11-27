// A model says "orange" where the board stores #rrggbb, and a fill the board
// can't parse renders as nothing, so names resolve here before reaching a shape.
const NAMED_COLORS = {
    black: "#1a1a1a",
    white: "#ffffff",
    gray: "#9ca3af",
    grey: "#9ca3af",
    red: "#ef4444",
    orange: "#f97316",
    amber: "#f59e0b",
    yellow: "#facc15",
    gold: "#eab308",
    lime: "#84cc16",
    green: "#22c55e",
    teal: "#14b8a6",
    cyan: "#06b6d4",
    blue: "#3b82f6",
    indigo: "#6366f1",
    purple: "#a855f7",
    violet: "#8b5cf6",
    pink: "#ec4899",
    brown: "#a16207",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const normalizeColor = (value) => {
    const candidate = String(value ?? "")
        .trim()
        .toLowerCase();
    if (HEX_COLOR.test(candidate)) return candidate;
    return NAMED_COLORS[candidate] ?? null;
};

const channels = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

const NEUTRAL_SATURATION = 0.12;

const hsl = (hex) => {
    const [r, g, b] = channels(hex).map((channel) => channel / 255);
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    const lightness = (high + low) / 2;
    const spread = high - low;
    if (spread === 0) return { hue: 0, saturation: 0, lightness };
    const saturation = spread / (1 - Math.abs(2 * lightness - 1));
    const hue = high === r ? ((g - b) / spread + 6) % 6 : high === g ? (b - r) / spread + 2 : (r - g) / spread + 4;
    return { hue: hue * 60, saturation, lightness };
};

// Everyday names by where their hue sits on the wheel; rarer words such as lime or amber are understood, never used.
const HUES = [
    { name: "red", hue: 0 },
    { name: "orange", hue: 28 },
    { name: "yellow", hue: 52 },
    { name: "green", hue: 125 },
    { name: "teal", hue: 175 },
    { name: "blue", hue: 215 },
    { name: "purple", hue: 270 },
    { name: "pink", hue: 330 },
];

// The everyday word for a colour, so a person reads "light green" where the board stores #dcfce7: named by hue,
// since a pale colour sits nearer white than its own hue by plain distance.
export const colorName = (value) => {
    const hex = normalizeColor(value);
    if (!hex) return null;
    const { hue, saturation, lightness } = hsl(hex);
    if (saturation < NEUTRAL_SATURATION || lightness > 0.97 || lightness < 0.08) return lightness > 0.85 ? "white" : lightness < 0.2 ? "black" : "grey";
    const around = (other) => Math.min(Math.abs(hue - other), 360 - Math.abs(hue - other));
    const { name } = HUES.reduce((best, candidate) => (around(candidate.hue) < around(best.hue) ? candidate : best));
    return lightness > 0.75 ? `light ${name}` : lightness < 0.33 ? `dark ${name}` : name;
};
