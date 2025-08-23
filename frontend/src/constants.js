export const COLORS = {
    BLACK: "#000000",
    RED: "#ef4444",
    GREEN: "#22c55e",
    BLUE: "#3b82f6",
    ORANGE: "#f97316",
    YELLOW: "#eab308",
    PURPLE: "#a855f7",
    PINK: "#ec4899",
    BROWN: "#a3a3a3",
    WHITE: "#ffffff",
    GRAY: "#808080",
    CYAN: "#00FFFF",
    MAGENTA: "#FF00FF",
    LIME: "#32CD32",
    NAVY: "#000080",
    MAROON: "#800000",
    TEAL: "#008080",
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
    HAND: "Hand",
    PENCIL: "Pencil",
    ERASER: "Eraser",
    RECTANGLE: "Rectangle",
    UNDO: "Undo",
    REDO: "Redo",
};

// Expanded color array with more important colors
const COLOR_ARRAY = [
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

export const BRUSH_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

const ROUTES = {
    HOME: "/",
    LOGIN: "/login",
    REGISTER: "/register",
    WHITEBOARD: "/whiteboard",
};

const MOCK_USERS = [
    {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
    },
    {
        id: 2,
        name: "Jane Smith",
        email: "jane@example.com",
        password: "password123",
    },
    {
        id: 3,
        name: "Demo User",
        email: "demo@whiteboard.com",
        password: "demo123",
    },
];

const MOCK_AUTH_STATE = {
    isAuthenticated: false,
    user: null,
    loading: false,
};

const TOOL_CONFIGS = {
    [MENU_ITEMS.HAND]: {
        cursor: "grab",
        allowSizeChange: false,
        allowColorChange: false,
        allowOpacity: false,
    },
    [MENU_ITEMS.PENCIL]: {
        cursor: "crosshair",
        allowSizeChange: true,
        allowColorChange: true,
        allowOpacity: true,
    },
    [MENU_ITEMS.ERASER]: {
        cursor: "grab",
        allowSizeChange: true,
        allowColorChange: false,
        allowOpacity: false,
    },
    [MENU_ITEMS.RECTANGLE]: {
        cursor: "crosshair",
        allowSizeChange: true,
        allowColorChange: true,
        allowOpacity: true,
    },
    [MENU_ITEMS.UNDO]: {
        cursor: "default",
        allowSizeChange: false,
        allowColorChange: false,
        allowOpacity: false,
    },
    [MENU_ITEMS.REDO]: {
        cursor: "default",
        allowSizeChange: false,
        allowColorChange: false,
        allowOpacity: false,
    },
};

const CANVAS_SETTINGS = {
    DEFAULT_WIDTH: 1500,
    DEFAULT_HEIGHT: 1500,
    MIN_ZOOM: 0.8,
    MAX_ZOOM: 5,
    GRID_SIZE: 20,
    HISTORY_LIMIT: 50,
};

export {
    COLOR_ARRAY,
    FONT_SIZES,
    ROUTES,
    MOCK_USERS,
    MOCK_AUTH_STATE,
    TOOL_CONFIGS,
    CANVAS_SETTINGS,
};
