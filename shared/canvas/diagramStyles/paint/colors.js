import { colorTokenFor } from "../../color/colorTokens.js";
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "../../color/contrast.js";

const DARK_TEXT = "#1f2937";
const LIGHT_TEXT = "#ffffff";
const NEUTRAL = -1;

// Colours that mean the same thing whatever the look: argument sides, alerts
// and the classic event storming sticky colours.
const KIND_TONES = { pro: "#16a34a", con: "#dc2626", rebuttal: "#d97706", hotspot: "#ec4899" };
const KIND_SOFT_TONES = { pro: "#dcfce7", con: "#fee2e2", rebuttal: "#fef3c7", hotspot: "#fce7f3" };
const STORM_STICKIES = { event: "#fdba74", command: "#93c5fd", person: "#fde68a", policy: "#d8b4fe", system: "#f9a8d4", hotspot: "#f472b6" };
export const ALERT = "#dc2626";

export const readableTextOn = (fill, preferred) => {
    if (!fill || fill.startsWith("rgba")) return preferred;
    if (preferred && contrastRatio(fill, preferred) >= WCAG_AA_NORMAL_TEXT) return preferred;
    return contrastRatio(fill, DARK_TEXT) >= contrastRatio(fill, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
};

// Black, white and near-black ink on the board's own ground take the theme's
// tokens, so a diagram stays legible on a dark board.
export const inkFields = (hex, onBoardGround) => {
    if (onBoardGround && isDarkInk(hex)) return { color: "#000000", colorToken: colorTokenFor("#000000") };
    return { color: hex, colorToken: onBoardGround ? (colorTokenFor(hex) ?? null) : null };
};

const isDarkInk = (hex) => /^#[0-9a-f]{6}$/i.test(hex ?? "") && contrastRatio(hex, "#000000") < 2.2;

const categoryKeyFor = (node, sceneNode, colorBy) => {
    switch (colorBy) {
        case "tier":
            return node.tier ?? node.group ?? sceneNode.lane ?? null;
        case "status":
            return node.status ?? null;
        case "owner":
            return node.owner ?? node.lane ?? null;
        case "accent":
        case "heat":
            return null;
        default:
            return sceneNode.category ?? (sceneNode.branch >= 0 ? sceneNode.branch : null) ?? node.group ?? sceneNode.lane ?? node.kind ?? null;
    }
};

// Each node's palette slot, in first-seen order so the legend reads in the
// diagram's own order. Heat maps values onto the sequential palette instead.
export const assignCategories = (model, scene, levers) => {
    const keys = [];
    const slots = new Map();
    const values = model.nodes.map((node) => node.value).filter(Number.isFinite);
    const [low, high] = [Math.min(...values), Math.max(...values)];
    model.nodes.forEach((node) => {
        const sceneNode = scene.nodes[node.id];
        if (!sceneNode) return;
        if (levers.colorBy === "heat") {
            slots.set(node.id, Number.isFinite(node.value) ? Math.min(5, Math.floor(((node.value - low) / (high - low || 1)) * 5.999)) : NEUTRAL);
            return;
        }
        if (levers.colorBy === "accent") {
            slots.set(node.id, sceneNode.role === "root" || node.root ? 0 : NEUTRAL);
            return;
        }
        const key = categoryKeyFor(node, sceneNode, levers.colorBy);
        if (key === null || key === undefined) {
            slots.set(node.id, 0);
            return;
        }
        if (typeof key === "number") {
            slots.set(node.id, key);
            if (!keys.includes(key)) keys.push(key);
            return;
        }
        if (!keys.includes(key)) keys.push(key);
        slots.set(node.id, keys.indexOf(key));
    });
    return { slotOf: (id) => slots.get(id) ?? 0, keys, range: levers.colorBy === "heat" ? [low, high] : null };
};

const isNeutral = (slot) => slot === NEUTRAL;

// The node's fill, outline and text colours for its slot under the fill lever.
export const nodeColours = ({ slot, node, palette, levers, highlighted }) => {
    const pick = (list) => list[((slot % list.length) + list.length) % list.length];
    const text = palette.text ?? palette.ink;
    const neutral = isNeutral(slot);
    const tone = KIND_TONES[node.kind];
    const strong = tone ?? (neutral ? palette.ink : pick(palette.colors));
    const soft = tone ? KIND_SOFT_TONES[node.kind] : neutral ? null : pick(palette.pastels);
    const ink = palette.strokeByCategory && !neutral ? strong : palette.ink;
    let colours;
    switch (levers.fill) {
        case "pastel":
            colours = { fill: soft, stroke: ink, fillStyle: "solid" };
            break;
        case "bold":
            colours = { fill: neutral ? null : strong, stroke: palette.noStroke ? strong : ink, fillStyle: "solid" };
            break;
        case "hachure":
        case "crosshatch":
        case "dots":
            colours = {
                fill: neutral ? null : palette.fillCycle ? palette.ink : strong,
                stroke: ink,
                fillStyle: palette.fillCycle ? palette.fillCycle[slot % palette.fillCycle.length] : levers.fill,
            };
            break;
        case "watercolour":
            colours = { fill: soft, stroke: ink, fillStyle: "wash" };
            break;
        case "tint":
            colours = { fill: soft, stroke: neutral ? ink : strong, fillStyle: "solid" };
            break;
        case "tiles":
            colours = { fill: soft, stroke: neutral ? ink : strong, fillStyle: "tiles" };
            break;
        default:
            colours = { fill: null, stroke: palette.strokeByCategory || tone ? strong : ink, fillStyle: "solid" };
    }
    if (colours.fillStyle === "none") colours = { ...colours, fill: null, fillStyle: "solid" };
    if (palette.spotlight) {
        colours = highlighted
            ? { fill: palette.pastels[0], stroke: palette.accent, fillStyle: "solid" }
            : { fill: palette.pastels[0], stroke: palette.muted, fillStyle: "solid" };
    }
    const solidFill = colours.fill && (colours.fillStyle === "solid" || colours.fillStyle === "wash" || colours.fillStyle === "tiles") ? colours.fill : null;
    const preferredText = palette.lightText && solidFill ? LIGHT_TEXT : highlighted && palette.spotlight ? "#f5f0e6" : text;
    return { ...colours, text: solidFill ? readableTextOn(solidFill, preferredText) : preferredText };
};

const STOP_STATUS = /^(refused|rejected|denied|blocked|failed|failure|error|danger|critical|stop|stopped)$/i;
const GO_STATUS = /^(allowed|accepted|approved|success|succeeded|ok|done|live|go|granted|passed)$/i;

const mixHex = (hex, over, amount) => {
    const channels = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
    const [a, b] = [channels(hex), channels(over)];
    return `#${a
        .map((channel, index) =>
            Math.round(channel * amount + b[index] * (1 - amount))
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
};

// An outcome's colour by what it means: red for a stop, the look's first colour for a go.
// The fill is that colour washed into the ground, so the text keeps the look's ink.
export const outcomeColours = (status, palette) => {
    const tone = STOP_STATUS.test(status ?? "") ? ALERT : GO_STATUS.test(status ?? "") ? palette.colors[0] : null;
    if (!tone) return null;
    const ground = palette.ground ?? "#ffffff";
    return { fill: mixHex(tone, ground, 0.16), stroke: tone, fillStyle: "solid", text: palette.text ?? palette.ink };
};

export const stickyColour = (node, slot, palette) =>
    STORM_STICKIES[node.kind] ?? palette.pastels[((slot % palette.pastels.length) + palette.pastels.length) % palette.pastels.length];

export const groupTint = (slot, palette) => palette.pastels[((slot % palette.pastels.length) + palette.pastels.length) % palette.pastels.length];
export const categoryStrong = (slot, palette) => palette.colors[((slot % palette.colors.length) + palette.colors.length) % palette.colors.length];
