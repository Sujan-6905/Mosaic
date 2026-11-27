// Each How it works diagram is a small board: real Mosaic elements, drawn by the board's own renderer.

// Each diagram is a list of [left, top, width, height, label, variant] in
// percentages of the figure.
const DIAGRAMS = {
    conflict: [
        [8, 22, 18, 18, "v12", "box"],
        [8, 58, 18, 18, "v13", "gold"],
        [26, 30, 14, 0.8, "", "line"],
        [26, 67, 14, 0.8, "", "goldLine"],
        [40, 52, 18, 26, "kept v13", "gold"],
        [68, 26, 24, 34, "Ship it", "sticky"],
        [64, 64, 14, 10, "Akash", "sky"],
        [80, 64, 12, 10, "Riya", "mint"],
    ],
    canvas: [
        ...Array.from({ length: 26 }, (_unused, i) => [4 + ((i * 37) % 90), 6 + ((i * 53) % 84), 5, 9, "", i % 3 === 0 ? "dot" : "dotFaint"]),
        [26, 18, 44, 60, "viewport", "viewport"],
    ],
    history: [
        [6, 48, 88, 0.8, "", "line"],
        ...[10, 22, 34, 46, 58, 70, 82].map((left, i) => [left, 44, 3, 8, "", i % 3 === 0 ? "goldPoint" : "point"]),
        [8, 62, 22, 14, "versions", "box"],
        [39, 62, 22, 14, "replay", "box"],
        [70, 62, 22, 14, "branches", "gold"],
        [6, 20, 30, 12, "append-only log", "note"],
    ],
    assist: [
        [6, 20, 26, 60, "{ nodes, edges }", "panel"],
        [34, 49, 10, 0.8, "", "goldLine"],
        [48, 40, 14, 18, "", "box"],
        [64, 18, 14, 18, "", "box"],
        [64, 62, 14, 18, "", "box"],
        [80, 40, 14, 18, "", "box"],
        [62, 85, 32, 10, "positions: local engine", "goldNote"],
    ],
    styles: [
        [6, 20, 24, 16, "72 structures", "box"],
        [6, 60, 24, 16, "43 looks", "box"],
        [30, 28, 12, 0.8, "", "line"],
        [30, 68, 12, 0.8, "", "line"],
        [42, 38, 18, 24, "layout engine", "gold"],
        [60, 50, 8, 0.8, "", "goldLine"],
        [70, 18, 12, 12, "", "box"],
        [70, 44, 12, 12, "", "sky"],
        [84, 44, 12, 12, "", "mint"],
        [70, 70, 12, 12, "", "box"],
        [62, 86, 34, 8, "same diagram, new look", "goldNote"],
    ],
    boundary: [
        [46, 10, 2, 80, "", "wall"],
        [10, 22, 26, 14, "stroke ok", "box"],
        [10, 44, 26, 14, "note ok", "box"],
        [10, 66, 26, 14, "bad frame", "bad"],
        [58, 22, 26, 14, "room", "gold"],
        [58, 44, 26, 14, "room", "gold"],
        [58, 66, 26, 14, "dropped", "badNote"],
    ],
    scale: [
        [8, 18, 22, 22, "instance A", "box"],
        [8, 60, 22, 22, "instance B", "box"],
        [30, 29, 18, 0.8, "", "line"],
        [30, 71, 18, 0.8, "", "line"],
        [48, 32, 24, 36, "Redis rooms", "store"],
        [76, 40, 18, 20, "any client", "note"],
    ],
    agents: [
        [4, 14, 24, 13, "Claude Code", "box"],
        [4, 42, 24, 13, "Cursor", "box"],
        [4, 70, 24, 13, "Codex", "box"],
        [28, 20.5, 12, 0.8, "", "line"],
        [28, 48.5, 12, 0.8, "", "line"],
        [28, 76.5, 12, 0.8, "", "line"],
        [40, 34, 20, 30, "MCP and OAuth", "gold"],
        [60, 49, 10, 0.8, "", "goldLine"],
        [70, 26, 26, 46, "the room people use", "panel"],
        [70, 80, 28, 10, "undo per turn", "goldNote"],
    ],
    system: [
        [3, 40, 15, 18, "browser", "box"],
        [3, 72, 15, 16, "agents", "sky"],
        [26, 4, 22, 16, "Next.js, Vercel", "box"],
        [36.7, 20, 0.6, 22, "", "line"],
        [26, 42, 22, 46, "Express, Socket.io", "gold"],
        [18, 49, 8, 0.8, "", "goldLine"],
        [18, 80, 8, 0.8, "", "goldLine"],
        [48, 50, 14, 0.8, "", "line"],
        [48, 78, 14, 0.8, "", "line"],
        [62, 38, 18, 24, "Couchbase", "store"],
        [62, 68, 18, 20, "Redis rooms", "store"],
        [66, 6, 28, 16, "hosted model", "box"],
        [66, 24, 30, 8, "called by the server only", "goldNote"],
    ],
    grounding: [
        [40, 10, 20, 16, "scene", "gold"],
        [10, 46, 20, 16, "group", "box"],
        [40, 46, 20, 16, "relations", "box"],
        [70, 46, 20, 16, "time", "box"],
        [49.5, 26, 0.6, 20, "", "line"],
        [20, 36, 60, 0.6, "", "line"],
        [30, 78, 40, 12, "resolver: refs, not ids", "note"],
    ],
};

// Tokens travelling through each diagram on a loop, in percentages of the figure:
// [left, top, travel across, travel down, delay in seconds, variant].
const PACKETS = {
    conflict: [
        [26, 30, 14, 26, 0, "faint"],
        [26, 67, 14, -6, 0.9, "gold"],
    ],
    canvas: [],
    history: [[6, 47.6, 88, 0, 0, "gold"]],
    assist: [
        [34, 48.4, 12, 0, 0, "gold"],
        [62, 49, 16, 0, 1.1, "gold"],
    ],
    styles: [
        [30, 27.6, 12, 0, 0, "gold"],
        [30, 67.6, 12, 0, 0.8, "gold"],
        [60, 49.6, 10, 0, 1.6, "gold"],
    ],
    boundary: [
        [36, 28, 22, 0, 0, "gold"],
        [36, 50, 22, 0, 1, "gold"],
        [36, 72, 9, 0, 2, "stopped"],
    ],
    scale: [
        [30, 28.6, 18, 0, 0, "gold"],
        [48, 70.6, -18, 0, 1.2, "gold"],
    ],
    agents: [
        [28, 20.1, 12, 0, 0, "gold"],
        [28, 76.1, 12, 0, 0.7, "gold"],
        [60, 48.6, 10, 0, 1.4, "gold"],
    ],
    system: [
        [18, 48.6, 8, 0, 0, "gold"],
        [18, 79.6, 8, 0, 0.9, "gold"],
        [48, 49.6, 14, 0, 0.4, "gold"],
        [48, 77.6, 14, 0, 1.4, "gold"],
    ],
    grounding: [
        [49.2, 26, 0, 20, 0, "gold"],
        [49.2, 36, -29, 10, 0.9, "gold"],
        [49.2, 36, 31, 10, 1.8, "gold"],
    ],
};

export const FIGURE = { width: 1000, height: 620 };
const toX = (percent) => (percent / 100) * FIGURE.width;
const toY = (percent) => (percent / 100) * FIGURE.height;

const INK = { color: "#000000", colorToken: "ink-primary" };
const DARK_TEXT = "#1a1206";
const base = (index) => ({ zIndex: index + 1, rotation: 0, groupId: null, frameId: null, locked: false, opacity: 100 });
const label = (text, size = 22, textColor) =>
    text ? { text, fontSize: size, ...(textColor ? { textColor } : { textColorToken: "ink-primary", textColor: "#000000" }) } : {};

const shape = (shapeType, box, extra) => ({ type: "shape", shapeType, ...box, size: 2, cornerRadius: shapeType === "Rectangle" ? 12 : undefined, ...extra });
const filled = (fill, edge, text) => ({ color: edge, fillColor: fill, ...label(text, 22, DARK_TEXT) });

// One node of the old figure notation as a board element.
const elementFor = ([left, top, width, height, text, variant]) => {
    const box = { startX: toX(left), startY: toY(top), endX: toX(left + width), endY: toY(top + height) };
    const midY = (box.startY + box.endY) / 2;
    const midX = (box.startX + box.endX) / 2;
    const vertical = width < 1 && height >= 1;
    switch (variant) {
        case "box":
        case "panel":
            return shape("Rectangle", box, { ...INK, fillColor: null, ...label(text) });
        case "gold":
            return shape("Rectangle", box, filled("#ffb43c", "#c07d1c", text));
        case "sky":
            return shape("Rectangle", box, filled("#9fd3ff", "#4f8fc0", text));
        case "mint":
            return shape("Rectangle", box, filled("#b8e6b0", "#5c9a52", text));
        case "bad":
            return shape("Rectangle", box, { color: "#de5816", fillColor: null, strokeStyle: "dashed", ...label(text, 22, "#de5816") });
        case "store":
            return shape("Cylinder", box, { ...INK, fillColor: null, ...label(text) });
        case "wall":
            return shape("Rectangle", box, { color: "#868a92", fillColor: "#868a92" });
        case "viewport":
            return shape("Rectangle", box, { color: "#e09a2c", fillColor: null, strokeStyle: "dashed", ...label(text, 20, "#e09a2c"), verticalAlign: "top" });
        case "dot":
        case "goldPoint":
            return shape("Ellipse", box, { color: "#e09a2c", fillColor: "#ffd27a" });
        case "dotFaint":
        case "point":
            return shape("Ellipse", box, { color: "#868a92", fillColor: "#868a92", opacity: 60 });
        case "sticky":
            return {
                type: "sticky",
                x: box.startX,
                y: box.startY,
                width: box.endX - box.startX,
                height: box.endY - box.startY,
                text,
                color: "#1f2937",
                fillColor: "#fef08a",
                size: 26,
                align: "left",
            };
        case "note":
        case "goldNote":
        case "badNote":
            return {
                type: "text",
                x: box.startX,
                y: box.startY,
                width: box.endX - box.startX,
                text,
                size: 20,
                align: "left",
                ...(variant === "note" ? INK : { color: variant === "goldNote" ? "#e09a2c" : "#de5816" }),
            };
        case "line":
        case "goldLine":
            return {
                type: "connector",
                startX: vertical ? midX : box.startX,
                startY: vertical ? box.startY : midY,
                endX: vertical ? midX : box.endX,
                endY: vertical ? box.endY : midY,
                startElementId: null,
                endElementId: null,
                ...(variant === "goldLine" ? { color: "#e09a2c" } : INK),
                size: 3,
                arrowStart: false,
                arrowEnd: true,
            };
        default:
            return null;
    }
};

export const diagramElements = (id) =>
    Object.fromEntries(
        DIAGRAMS[id]
            .map((node, index) => {
                const element = elementFor(node);
                return element && [`${id}-${index}`, { ...base(index), ...element }];
            })
            .filter(Boolean),
    );

// The tokens travelling each diagram, in board units: where they start and how far they go.
export const diagramPackets = (id) =>
    PACKETS[id].map(([left, top, travelX, travelY, delay, variant]) => ({ x: toX(left), y: toY(top), dx: toX(travelX), dy: toY(travelY), delay, variant }));

// The site is always graphite, whatever the app theme, so ink that follows the theme is drawn as bone there.
const SITE_INK = "#ecebe6";
export const onSiteSurface = (elements) =>
    Object.fromEntries(
        Object.entries(elements).map(([id, element]) => [
            id,
            {
                ...element,
                ...(element.colorToken === "ink-primary" ? { color: SITE_INK, colorToken: null } : {}),
                ...(element.textColorToken === "ink-primary" ? { textColor: SITE_INK, textColorToken: null } : {}),
            },
        ]),
    );
