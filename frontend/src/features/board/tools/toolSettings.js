export const COLORS = {
    BLACK: "#000000",
    RED: "#ef4444",
    GREEN: "#22c55e",
    BLUE: "#3b82f6",
    ORANGE: "#f97316",
    YELLOW: "#eab308",
    PURPLE: "#a855f7",
    TEAL: "#008080",
    PINK: "#ec4899",
    BROWN: "#a3a3a3",
    WHITE: "#ffffff",
    GRAY: "#808080",
    CYAN: "#00FFFF",
    MAGENTA: "#FF00FF",
    LIME: "#32CD32",
    NAVY: "#000080",
    MAROON: "#800000",
    OLIVE: "#808000",
    SILVER: "#C0C0C0",
    GOLD: "#FFD700",
    INDIGO: "#4B0082",
    VIOLET: "#8A2BE2",
    TURQUOISE: "#40E0D0",
    CORAL: "#FF7F50",
    SALMON: "#FA8072",
    KHAKI: "#F0E68C",
    PLUM: "#DDA0DD",
    ORCHID: "#DA70D6",
    TAN: "#D2B48C",
    CRIMSON: "#DC143C",
};

export const MENU_ITEMS = {
    SELECT: "Select",
    HAND: "Hand",
    PENCIL: "Pencil",
    ERASER: "Eraser",
    RECTANGLE: "Rectangle",
    CIRCLE: "Circle",
    STAR: "Star",
    ELLIPSE: "Ellipse",
    TRIANGLE: "Triangle",
    DIAMOND: "Diamond",
    ARROW: "Arrow",
    LINE: "Line",
    UNDO: "Undo",
    REDO: "Redo",
    // PENCIL doubles as both the toolbar group button and the pencil-style
    // draw tool itself: picking either one selects the same "Pencil" state.
    PEN: "Pen",
    HIGHLIGHTER: "Highlighter",
    FILL_COLOR: "Fill_Color",
    TEXT: "Text",
    STICKY: "Sticky",
    IMAGE: "Image",
    FRAME: "Frame",
    CONNECTOR: "Connector",
    LASER: "Laser",
    COMMENT: "Comment",
    LASSO: "Lasso",
    BUCKET: "Bucket",
    EMBED: "Embed",
    TABLE: "Table",
    STAMP: "Stamp",
    HEXAGON: "Hexagon",
    PENTAGON: "Pentagon",
    PARALLELOGRAM: "Parallelogram",
    TRAPEZOID: "Trapezoid",
    CYLINDER: "Cylinder",
    DOCUMENT: "Document",
    CLOUD: "Cloud",
    CALLOUT: "Callout",
    BLOCK_ARROW: "BlockArrow",
    PLUS: "Plus",
};

// Single-key shortcuts shown in tool tooltips; undo and redo appear for display and keep their own handlers.
export const MENU_ITEM_SHORTCUTS = {
    [MENU_ITEMS.SELECT]: "V",
    [MENU_ITEMS.HAND]: "H",
    [MENU_ITEMS.PENCIL]: "P",
    [MENU_ITEMS.ERASER]: "E",
    [MENU_ITEMS.RECTANGLE]: "R",
    [MENU_ITEMS.CIRCLE]: "O",
    [MENU_ITEMS.ARROW]: "A",
    [MENU_ITEMS.LINE]: "L",
    [MENU_ITEMS.UNDO]: "Ctrl+Z",
    [MENU_ITEMS.REDO]: "Ctrl+Shift+Z",
    [MENU_ITEMS.TEXT]: "T",
    [MENU_ITEMS.STICKY]: "S",
    [MENU_ITEMS.IMAGE]: "I",
    [MENU_ITEMS.FRAME]: "F",
    [MENU_ITEMS.CONNECTOR]: "C",
    [MENU_ITEMS.LASER]: "K",
    [MENU_ITEMS.COMMENT]: "M",
    [MENU_ITEMS.LASSO]: "Q",
    [MENU_ITEMS.BUCKET]: "B",
};

// Only each rail group's primary shortcut maps back to a tool; shapes resolve to the group's default.
export const SHORTCUT_KEY_TO_MENU_ITEM = {
    v: MENU_ITEMS.SELECT,
    h: MENU_ITEMS.HAND,
    p: MENU_ITEMS.PENCIL,
    e: MENU_ITEMS.ERASER,
    r: MENU_ITEMS.RECTANGLE,
    o: MENU_ITEMS.CIRCLE,
    a: MENU_ITEMS.ARROW,
    l: MENU_ITEMS.LINE,
    t: MENU_ITEMS.TEXT,
    s: MENU_ITEMS.STICKY,
    i: MENU_ITEMS.IMAGE,
    f: MENU_ITEMS.FRAME,
    c: MENU_ITEMS.CONNECTOR,
    k: MENU_ITEMS.LASER,
    m: MENU_ITEMS.COMMENT,
    q: MENU_ITEMS.LASSO,
    b: MENU_ITEMS.BUCKET,
};

// Tools with a size control, shared by ContextBar and the [ / ] shortcut, which needs it without a selection.
export const SIZE_ADJUSTABLE_TOOLS = [
    MENU_ITEMS.PENCIL,
    MENU_ITEMS.PEN,
    MENU_ITEMS.HIGHLIGHTER,
    MENU_ITEMS.ERASER,
    MENU_ITEMS.RECTANGLE,
    MENU_ITEMS.CIRCLE,
    MENU_ITEMS.ELLIPSE,
    MENU_ITEMS.TRIANGLE,
    MENU_ITEMS.DIAMOND,
    MENU_ITEMS.STAR,
    MENU_ITEMS.HEXAGON,
    MENU_ITEMS.PENTAGON,
    MENU_ITEMS.PARALLELOGRAM,
    MENU_ITEMS.TRAPEZOID,
    MENU_ITEMS.CYLINDER,
    MENU_ITEMS.DOCUMENT,
    MENU_ITEMS.CLOUD,
    MENU_ITEMS.CALLOUT,
    MENU_ITEMS.BLOCK_ARROW,
    MENU_ITEMS.PLUS,
    MENU_ITEMS.ARROW,
    MENU_ITEMS.LINE,
    MENU_ITEMS.CONNECTOR,
];

// The eraser's size range tops out below every drawing tool's.
export const maxSizeForTool = (tool) => (tool === MENU_ITEMS.ERASER ? 20 : 50);

// Same list minus the eraser, which has no opacity control: erasing is
// binary, not a blend.
export const OPACITY_ADJUSTABLE_TOOLS = SIZE_ADJUSTABLE_TOOLS.filter((tool) => tool !== MENU_ITEMS.ERASER);

export const LINE_STYLES = {
    PENCIL: "round",
    PEN: "square",
    HIGHLIGHTER: "butt",
};

// Shapes with an inside (fill, label room) versus every shape tool,
// including the open line/arrow ones.
export const CLOSED_SHAPE_TOOLS = [
    MENU_ITEMS.RECTANGLE,
    MENU_ITEMS.CIRCLE,
    MENU_ITEMS.ELLIPSE,
    MENU_ITEMS.TRIANGLE,
    MENU_ITEMS.DIAMOND,
    MENU_ITEMS.STAR,
    MENU_ITEMS.HEXAGON,
    MENU_ITEMS.PENTAGON,
    MENU_ITEMS.PARALLELOGRAM,
    MENU_ITEMS.TRAPEZOID,
    MENU_ITEMS.CYLINDER,
    MENU_ITEMS.DOCUMENT,
    MENU_ITEMS.CLOUD,
    MENU_ITEMS.CALLOUT,
    MENU_ITEMS.BLOCK_ARROW,
    MENU_ITEMS.PLUS,
];
export const SHAPE_TOOLS = [...CLOSED_SHAPE_TOOLS, MENU_ITEMS.ARROW, MENU_ITEMS.LINE];

// These draw a connector, so what they draw can bind to other elements.
export const CONNECTOR_TOOLS = [MENU_ITEMS.ARROW, MENU_ITEMS.LINE, MENU_ITEMS.CONNECTOR];

export const COLOR_ARRAY = [
    COLORS.BLACK,
    COLORS.RED,
    COLORS.BLUE,
    COLORS.GREEN,
    COLORS.ORANGE,
    COLORS.PURPLE,
    COLORS.PINK,
    COLORS.BROWN,
    COLORS.YELLOW,
    COLORS.CYAN,
    COLORS.MAGENTA,
    COLORS.LIME,
    COLORS.NAVY,
    COLORS.MAROON,
    COLORS.TEAL,
    COLORS.OLIVE,
    COLORS.INDIGO,
    COLORS.VIOLET,
    COLORS.TURQUOISE,
    COLORS.CORAL,
    COLORS.SALMON,
    COLORS.KHAKI,
    COLORS.PLUM,
    COLORS.ORCHID,
    COLORS.TAN,
    COLORS.CRIMSON,
    COLORS.GRAY,
    COLORS.SILVER,
    COLORS.GOLD,
    COLORS.WHITE,
];

// Typed/stepped rather than picked off a fixed list (see FontSizeStepper),
// so these are the clamp floor/ceiling, not a set of presets.
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 300;

// Google Fonts offered without typing a name: hand-drawn, sans, serif and mono.
export const GOOGLE_FONT_PICKS = [
    "Caveat",
    "Kalam",
    "Architects Daughter",
    "Patrick Hand",
    "Space Grotesk",
    "Bricolage Grotesque",
    "IBM Plex Sans",
    "Manrope",
    "Fraunces",
    "Instrument Serif",
    "DM Serif Display",
    "Playfair Display",
    "JetBrains Mono",
    "IBM Plex Mono",
];

// Shared styling the next shape or arrow is drawn with, whichever tool draws it.
export const DEFAULT_DRAW_STYLE = {
    strokeStyle: "solid",
    fillStyle: "solid",
    cornerRadius: 0,
    roughness: 0,
    pressure: 0.4,
    steadying: 0.55,
    routing: "straight",
    startHead: "none",
    endHead: "triangle",
};

export const FONT_SIZE_PRESETS = [12, 14, 16, 20, 24, 32, 48, 64, 96];

// Stickies cycle through this palette by creation order, so several on one board read apart from the start.
export const STICKY_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff"];
