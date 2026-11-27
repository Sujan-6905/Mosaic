import { MENU_ITEMS, STICKY_COLORS } from "../tools/toolSettings";
import { colorTokenFor } from "../rendering/colorResolver";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

// Fires at once if the last call was over `wait` ms ago, otherwise once more at the end with the latest arguments.
export const throttle = (fn, wait) => {
    let lastCallTime = 0;
    let timeoutId = null;
    let pendingArgs = null;
    return (...args) => {
        const now = Date.now();
        const remaining = wait - (now - lastCallTime);
        if (remaining <= 0) {
            lastCallTime = now;
            fn(...args);
        } else {
            pendingArgs = args;
            if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    lastCallTime = Date.now();
                    timeoutId = null;
                    fn(...pendingArgs);
                }, remaining);
            }
        }
    };
};

export const generateElementId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Always above the current top, so adding an element never renumbers another.
// The fields every element carries: order, rotation, theme ink, group and frame, and its lock.
export const withSchemaV2Fields = (base, elementsMap) => ({
    ...base,
    colorToken: colorTokenFor(base.color) ?? null,
    zIndex: nextZIndex(elementsMap),
    rotation: 0,
    groupId: null,
    frameId: null,
    locked: false,
});

// The board listens on its container so a gesture can start anywhere, which also catches its floating controls.
export const isBoardChrome = (target) => !!target.closest?.("[data-board-chrome]");

// Cycles the sticky palette by how many stickies already exist, rather
// than always defaulting to the same colour: see STICKY_COLORS.
export const nextStickyColor = (elementsMap) => {
    const stickyCount = Object.values(elementsMap).filter((el) => el.type === "sticky").length;
    return STICKY_COLORS[stickyCount % STICKY_COLORS.length];
};

// Counts the frames already there, so the numbering stays right across undo and remote inserts.
export const nextFrameName = (elementsMap) => {
    const frameCount = Object.values(elementsMap).filter((el) => el.type === "frame").length;
    return `Frame ${frameCount + 1}`;
};

export const DEFAULT_STICKY_SIZE = 200;
export const LASER_TRAIL_MS = 900;
export const ERASER_TRAIL_MS = 220;
export const MAX_IMAGE_INSERT_WIDTH = 480;
export const TIDY_ANIMATION_MS = 320;
// The organisation track's anchors only exist on the dashboard, so it's
// deliberately excluded from what's offered here.
export const WHITEBOARD_TOUR_TRACK_IDS = [
    "basics",
    "arrows",
    "tables",
    "catchUp",
    "architecture",
    "collaboration",
    "workshop",
    "ai",
    "diagramStyles",
    "versions",
    "replay",
    "branches",
    "pieces",
    "files",
    "shortcuts",
];

// For the ?debug=1 stress test: thousands of small shapes drawn the same way as hand-drawn ones.
const STRESS_TEST_SHAPES = [MENU_ITEMS.RECTANGLE, MENU_ITEMS.CIRCLE, MENU_ITEMS.LINE, MENU_ITEMS.TRIANGLE];
const STRESS_TEST_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#f97316", "#a855f7", "#000000"];
// Past this many changes at once, redrawing everything beats finding the tiles.
export const MAX_TILE_INVALIDATIONS = 1500;

export const generateStressTestElements = (count, canvasSize, zIndexBase) => {
    const elements = [];
    for (let i = 0; i < count; i++) {
        const startX = Math.random() * canvasSize;
        const startY = Math.random() * canvasSize;
        const color = STRESS_TEST_COLORS[i % STRESS_TEST_COLORS.length];
        elements.push({
            elementId: generateElementId(),
            element: {
                type: "shape",
                shapeType: STRESS_TEST_SHAPES[i % STRESS_TEST_SHAPES.length],
                startX,
                startY,
                endX: startX + 10 + Math.random() * 30,
                endY: startY + 10 + Math.random() * 30,
                color,
                fillColor: null,
                size: 1,
                opacity: 100,
                colorToken: colorTokenFor(color) ?? null,
                zIndex: zIndexBase + i + 1,
                rotation: 0,
                groupId: null,
                frameId: null,
                locked: false,
            },
        });
    }
    return elements;
};

// Snap distance on screen, turned into world units during a drag so it feels the same at every zoom.
export const SNAP_THRESHOLD_PX = 8;

// A rotation this close to a right angle locks to it, so 0, 90, 180 and 270 are easy to reach.
export const ROTATE_SNAP_THRESHOLD_DEG = 4;
export const SHIFT_ROTATE_STEP_DEG = 15;

// World-space, not screen pixels, so a duplicate/paste lands the same
// relative distance from its source regardless of zoom.
export const DUPLICATE_OFFSET = { dx: 24, dy: 24 };

// Default framing for a brand-new empty board, not a bound on where content can live.
export const DEFAULT_VIEW_WIDTH = 1200;
export const DEFAULT_VIEW_HEIGHT = 800;

const DEFAULT_SHAPE_WIDTH = 160;
const DEFAULT_SHAPE_HEIGHT = 100;
const DEFAULT_SQUARE_SIDE = 120;
const SQUARE_BY_DEFAULT = [MENU_ITEMS.CIRCLE, MENU_ITEMS.STAR, MENU_ITEMS.HEXAGON, MENU_ITEMS.PENTAGON, MENU_ITEMS.PLUS, MENU_ITEMS.DIAMOND];

// The box a drag draws: Shift keeps it square, Alt grows it from the press point
// outward. A circle only ever draws round.
export const shapeBoxFromDrag = (tool, start, x, y, { square = false, fromCenter = false } = {}) => {
    let dx = x - start.x;
    let dy = y - start.y;
    if (square || tool === MENU_ITEMS.CIRCLE) {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * side;
        dy = Math.sign(dy || 1) * side;
    }
    if (fromCenter) return { startX: start.x - dx, startY: start.y - dy, endX: start.x + dx, endY: start.y + dy };
    return { startX: start.x, startY: start.y, endX: start.x + dx, endY: start.y + dy };
};

// A click without a drag still places something the right size.
export const defaultShapeBox = (tool, point) => {
    const halfWidth = (SQUARE_BY_DEFAULT.includes(tool) ? DEFAULT_SQUARE_SIDE : DEFAULT_SHAPE_WIDTH) / 2;
    const halfHeight = (SQUARE_BY_DEFAULT.includes(tool) ? DEFAULT_SQUARE_SIDE : DEFAULT_SHAPE_HEIGHT) / 2;
    return { startX: point.x - halfWidth, startY: point.y - halfHeight, endX: point.x + halfWidth, endY: point.y + halfHeight };
};
