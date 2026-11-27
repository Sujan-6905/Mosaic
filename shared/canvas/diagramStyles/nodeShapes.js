import { DENSITY_SCALE } from "./levers.js";

// A node kind's silhouette before the look's shape language applies; notation can
// refine it (a state machine's start is a dot, a data-flow store is open ended).
const KIND_SHAPES = {
    start: "pill",
    end: "pill",
    decision: "diamond",
    person: "person",
    database: "cylinder",
    store: "cylinder",
    queue: "queue",
    client: "browser",
    phone: "phone",
    document: "document",
    folder: "folder",
    cloud: "cloud",
    fork: "bar",
    join: "bar",
    "gate-and": "and-gate",
    "gate-or": "or-gate",
    event: "circle",
    gateway: "hexagon",
    milestone: "diamond",
    note: "sticky",
};

const NOTATION_SHAPES = {
    state: { start: "dot", end: "target" },
    activity: { start: "dot", end: "target" },
    dataflow: { store: "datastore", database: "datastore", external: "box" },
    bpmn: { start: "event", end: "end-event", event: "event", decision: "gateway", task: "rounded" },
    er: {},
    class: {},
    decision: { start: "rounded", end: "rounded" },
};

// Silhouettes that never take the look's shape language: they mean something.
const SEMANTIC_ONLY = new Set(["dot", "target", "bar", "and-gate", "or-gate", "event", "end-event", "gateway", "datastore"]);

export const nodeShapeFor = (node, { structure, levers, look, categoryIndex = 0 }) => {
    const notation = structure.options?.notation;
    const fromNotation = notation ? NOTATION_SHAPES[notation]?.[node.kind] : null;
    if (fromNotation) return fromNotation;
    if (notation === "er" || notation === "class") return "box";
    if (KIND_SHAPES[node.kind] && SEMANTIC_ONLY.has(KIND_SHAPES[node.kind])) return KIND_SHAPES[node.kind];
    if (look.sticky) return "sticky";
    if (KIND_SHAPES[node.kind]) return KIND_SHAPES[node.kind];
    if (look.palette.shapeCycle) return look.palette.shapeCycle[categoryIndex % look.palette.shapeCycle.length];
    if (levers.depth === "isometric") return "iso";
    return structure.options?.nodeShape ?? levers.shape;
};

// Per-shape room for the label: how far a rectangle of text has to grow to
// clear the outline, and the smallest box that still reads as that shape.
const SHAPE_ROOM = {
    box: { pad: [16, 12], grow: 1, min: [96, 48] },
    rounded: { pad: [18, 12], grow: 1, min: [96, 48] },
    pill: { pad: [22, 10], grow: 1, min: [100, 44] },
    circle: { pad: [10, 10], grow: Math.SQRT2, min: [72, 72], square: true },
    hexagon: { pad: [24, 12], grow: 1.15, min: [110, 56] },
    cylinder: { pad: [16, 22], grow: 1, min: [96, 70] },
    person: { pad: [8, 6], grow: 1, min: [72, 96], labelBelow: true },
    browser: { pad: [14, 24], grow: 1, min: [120, 80] },
    phone: { pad: [10, 22], grow: 1, min: [72, 120] },
    folder: { pad: [16, 18], grow: 1, min: [110, 62] },
    queue: { pad: [26, 12], grow: 1, min: [120, 52] },
    cloud: { pad: [22, 18], grow: 1.3, min: [120, 72] },
    diamond: { pad: [8, 6], grow: 2, min: [116, 72] },
    document: { pad: [16, 16], grow: 1, min: [100, 60] },
    triangle: { pad: [12, 8], grow: 2, min: [110, 90] },
    sticky: { pad: [14, 14], grow: 1, min: [130, 110] },
    iso: { pad: [20, 26], grow: 1.1, min: [140, 84] },
    datastore: { pad: [30, 12], grow: 1, min: [130, 46] },
    gateway: { pad: [0, 0], grow: 1, min: [48, 48], fixed: true },
    event: { pad: [0, 0], grow: 1, min: [40, 40], fixed: true, labelBelow: true },
    "end-event": { pad: [0, 0], grow: 1, min: [40, 40], fixed: true, labelBelow: true },
    dot: { pad: [0, 0], grow: 1, min: [24, 24], fixed: true, noLabel: true },
    target: { pad: [0, 0], grow: 1, min: [28, 28], fixed: true, noLabel: true },
    bar: { pad: [0, 0], grow: 1, min: [160, 8], fixed: true, noLabel: true },
    "and-gate": { pad: [0, 0], grow: 1, min: [44, 48], fixed: true, labelBelow: true },
    "or-gate": { pad: [0, 0], grow: 1, min: [44, 48], fixed: true, labelBelow: true },
    none: { pad: [6, 4], grow: 1, min: [40, 24] },
};

export const shapeRoom = (shape) => SHAPE_ROOM[shape] ?? SHAPE_ROOM.box;

const MAX_TEXT_WIDTH = 220;
const WRAP_SLACK = 1;
const LINE_HEIGHT = 1.3;

const textBlock = (text, fontSize, maxWidth, metrics) => {
    const width = Math.min(maxWidth, Math.ceil(metrics.textWidth(text, fontSize)) + WRAP_SLACK);
    const lines = metrics.lineCount(text, width, fontSize);
    return { width, height: lines * fontSize * LINE_HEIGHT };
};

// The label and second line a node shows, given the type levers.
export const nodeTexts = (node, levers) => {
    const label = levers.caps ? node.label.toUpperCase() : node.label;
    const sub = levers.twoLines && node.detail ? node.detail : null;
    return { label, sub };
};

export const fontSizeFor = (levers, look) => {
    const base = DENSITY_SCALE[levers.density]?.font ?? 14;
    return look.id === "high-contrast" ? base + 3 : base;
};

// The box a node needs for its label in its shape. A structure can widen the
// text column (tables, cards) or force a size (dots, bars, gates).
export const sizeNode = (node, shape, { levers, look, metrics, maxTextWidth = MAX_TEXT_WIDTH, scale = 1 }) => {
    const room = shapeRoom(shape);
    if (room.fixed) return { w: room.min[0] * scale, h: room.min[1] * scale };
    const fontSize = fontSizeFor(levers, look) * scale;
    const { label, sub } = nodeTexts(node, levers);
    const main = textBlock(label, fontSize, maxTextWidth, metrics);
    const second = sub ? textBlock(sub, fontSize * 0.82, maxTextWidth, metrics) : { width: 0, height: 0 };
    const textWidth = Math.max(main.width, second.width);
    const textHeight = main.height + (sub ? second.height + 2 : 0);
    let w = (textWidth + room.pad[0] * 2) * room.grow;
    let h = (textHeight + room.pad[1] * 2) * room.grow;
    if (room.labelBelow) h += textHeight;
    w = Math.ceil(Math.max(room.min[0] * scale, w));
    h = Math.ceil(Math.max(room.min[1] * scale, h));
    if (room.square) w = h = Math.max(w, h);
    if (levers.icons === "leading" || levers.icons === "tile") w += 34;
    if (levers.icons === "big") h += 40;
    return { w, h };
};
