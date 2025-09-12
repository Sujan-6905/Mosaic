import { createSlice } from "@reduxjs/toolkit";
import { COLORS, MENU_ITEMS, LINE_STYLES } from "@/constants";

const initialState = {
    [MENU_ITEMS.HAND]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
    },
    [MENU_ITEMS.PENCIL]: {
        color: COLORS.BLACK,
        size: 3,
        opacity: 100,
        style: LINE_STYLES.PENCIL,
    },
    [MENU_ITEMS.ERASER]: {
        color: COLORS.WHITE,
        size: 5,
        opacity: 100,
    },
    [MENU_ITEMS.RECTANGLE]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
    },
    [MENU_ITEMS.CIRCLE]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
    },
    [MENU_ITEMS.ELLIPSE]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
    },
    [MENU_ITEMS.TRIANGLE]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
    },
    [MENU_ITEMS.STAR]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
    },
    [MENU_ITEMS.ARROW]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
    },
    [MENU_ITEMS.LINE]: {
        color: COLORS.BLACK,
        size: 1,
        opacity: 100,
        fillColor: null,
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
    [MENU_ITEMS.PENCIL_PENCIL]: {
        color: COLORS.BLACK,
        size: 3,
        opacity: 80, // Lower opacity for pencil effect
        style: LINE_STYLES.PENCIL,
    },
    [MENU_ITEMS.PENCIL_PEN]: {
        color: COLORS.BLACK,
        size: 3,
        opacity: 100, // Full opacity for a solid pen line
        style: LINE_STYLES.PEN,
    },
    [MENU_ITEMS.PENCIL_HIGHLIGHTER]: {
        color: COLORS.YELLOW,
        size: 15,
        opacity: 50,
        style: LINE_STYLES.HIGHLIGHTER,
    },
};

const toolboxSlice = createSlice({
    name: "toolbox",
    initialState,
    reducers: {
        changeColor: (state, action) => {
            state[action.payload.item].color = action.payload.color;
        },
        changeFillColor: (state, action) => {
            state[action.payload.item].fillColor = action.payload.fillColor;
        },
        changeBrushSize: (state, action) => {
            state[action.payload.item].size = action.payload.size;
        },
        changeOpacity: (state, action) => {
            state[action.payload.item].opacity = action.payload.opacity;
        },
        changeLineStyle: (state, action) => {
            state[action.payload.item].style = action.payload.style;
        },
    },
});

export const {
    changeColor,
    changeFillColor,
    changeBrushSize,
    changeOpacity,
    changeLineStyle,
} = toolboxSlice.actions;
export default toolboxSlice.reducer;
