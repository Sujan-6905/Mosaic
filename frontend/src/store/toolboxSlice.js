import { createSlice } from "@reduxjs/toolkit";
import { CLOSED_SHAPE_TOOLS, COLORS, DEFAULT_DRAW_STYLE, MENU_ITEMS, LINE_STYLES, SHAPE_TOOLS } from "@/features/board/tools/toolSettings";
import { STAMP_KINDS } from "../../../shared/canvas/elements/stamps.js";

const shapeDefaults = { color: COLORS.BLACK, size: 2, opacity: 100, fillColor: null };

const initialState = {
    ...Object.fromEntries(SHAPE_TOOLS.map((tool) => [tool, { ...shapeDefaults }])),
    drawStyle: DEFAULT_DRAW_STYLE,
    stampKind: STAMP_KINDS[0].id,
    [MENU_ITEMS.STAMP]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.SELECT]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.HAND]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.PENCIL]: {
        color: COLORS.BLACK,
        size: 3,
        opacity: 80,
        style: LINE_STYLES.PENCIL,
    },
    [MENU_ITEMS.ERASER]: {
        color: COLORS.WHITE,
        size: 5,
        opacity: 100,
    },
    [MENU_ITEMS.UNDO]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.REDO]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.PEN]: {
        color: COLORS.BLACK,
        size: 3,
        opacity: 100,
        style: LINE_STYLES.PEN,
    },
    [MENU_ITEMS.HIGHLIGHTER]: {
        color: COLORS.YELLOW,
        size: 15,
        opacity: 50,
        style: LINE_STYLES.HIGHLIGHTER,
    },
    [MENU_ITEMS.TEXT]: {
        color: COLORS.BLACK,
        size: 16,
        opacity: 100,
    },
    [MENU_ITEMS.CONNECTOR]: {
        color: COLORS.BLACK,
        size: 2,
        opacity: 100,
    },
    [MENU_ITEMS.LASSO]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.BUCKET]: {
        color: COLORS.BLUE,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.STICKY]: {
        color: COLORS.BLACK,
        size: 16,
        opacity: 100,
    },
};

// Every shape tool, the connector included, shares one colour, width and
// opacity, so changing tools never loses the look being worked with.
const SHAPE_FAMILY = [...CLOSED_SHAPE_TOOLS, MENU_ITEMS.ARROW, MENU_ITEMS.LINE, MENU_ITEMS.CONNECTOR];
const applyToTool = (state, item, field, value) => {
    const targets = SHAPE_FAMILY.includes(item) ? SHAPE_FAMILY : [item];
    targets.forEach((tool) => {
        state[tool][field] = value;
    });
};

const toolboxSlice = createSlice({
    name: "toolbox",
    initialState,
    reducers: {
        changeColor: (state, action) => {
            applyToTool(state, action.payload.item, "color", action.payload.color);
        },
        changeFillColor: (state, action) => {
            applyToTool(state, action.payload.item, "fillColor", action.payload.fillColor);
        },
        changeBrushSize: (state, action) => {
            applyToTool(state, action.payload.item, "size", action.payload.size);
        },
        changeOpacity: (state, action) => {
            applyToTool(state, action.payload.item, "opacity", action.payload.opacity);
        },
        changeLineStyle: (state, action) => {
            state[action.payload.item].style = action.payload.style;
        },
        changeDrawStyle: (state, action) => {
            state.drawStyle = { ...state.drawStyle, ...action.payload };
        },
        changeStampKind: (state, action) => {
            state.stampKind = action.payload;
        },
    },
});

export const { changeColor, changeFillColor, changeBrushSize, changeOpacity, changeLineStyle, changeDrawStyle, changeStampKind } = toolboxSlice.actions;
export default toolboxSlice.reducer;
