// Seeded random graphs within the limits the backend allows a model's diagram.

const WORDS = [
    "validate",
    "user",
    "session",
    "token",
    "retry",
    "payment",
    "gateway",
    "queue",
    "worker",
    "cache",
    "database",
    "notify",
    "email",
    "approve",
    "reject",
    "upload",
    "resize",
    "image",
    "store",
    "audit",
    "login",
    "password",
    "check",
    "limit",
    "reached",
    "schedule",
    "report",
    "export",
    "invoice",
    "webhook",
];
const EDGE_LABELS = ["yes", "no", "on success", "on failure", "HTTPS", "retry after backoff", "async event"];
const SHAPES = ["box", "box", "box", "ellipse", "diamond"];

export const seededRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const int = (rand, min, max) => min + Math.floor(rand() * (max - min + 1));

const label = (rand) => {
    const words = Array.from({ length: int(rand, 1, rand() < 0.15 ? 14 : 5) }, () => pick(rand, WORDS));
    const text = words.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1, 120);
};

const FAMILIES = ["chain", "tree", "skip", "loop", "dense", "orphans"];

export const randomDiagram = (seed) => {
    const rand = seededRandom(seed);
    const family = FAMILIES[seed % FAMILIES.length];
    const count = family === "chain" ? int(rand, 2, 12) : int(rand, 3, 30);
    const nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, label: label(rand), shape: pick(rand, SHAPES) }));
    const edges = [];
    const add = (from, to) => {
        if (from === to || edges.length >= 60) return;
        if (edges.some((e) => e.from === `n${from}` && e.to === `n${to}`)) return;
        edges.push({ from: `n${from}`, to: `n${to}`, ...(rand() < 0.3 ? { label: pick(rand, EDGE_LABELS) } : {}) });
    };

    for (let i = 1; i < count; i += 1) {
        if (family === "chain" || family === "loop") add(i - 1, i);
        else if (family === "tree" || family === "orphans") {
            if (family === "orphans" && rand() < 0.3) continue;
            add(int(rand, 0, i - 1), i);
        } else add(int(rand, 0, i - 1), i);
    }
    if (family === "skip") for (let k = 0; k < count / 2; k += 1) add(int(rand, 0, count - 3), int(rand, 2, count - 1));
    if (family === "loop") for (let k = 0; k < Math.max(1, count / 4); k += 1) add(int(rand, 2, count - 1), int(rand, 0, 1));
    if (family === "dense") for (let k = 0; k < count; k += 1) add(int(rand, 0, count - 1), int(rand, 0, count - 1));

    return { family, nodes, edges };
};
