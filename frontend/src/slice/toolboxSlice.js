import { createSlice } from "@reduxjs/toolkit";
import { COLORS, MENU_ITEMS } from "@/constants";

const initialState = {
  [MENU_ITEMS.HAND]: {
    color: COLORS.BLACK,
    size: 1,
    opacity: 1,
  },
  [MENU_ITEMS.PENCIL]: {
    color: COLORS.BLACK,
    size: 3,
    opacity: 1,
  },
  [MENU_ITEMS.ERASER]: {
    color: COLORS.WHITE,
    size: 3,
    opacity: 1,
  },
  [MENU_ITEMS.RECTANGLE]: {
    color: COLORS.BLACK,
    size: 1,
    fill: false,
    opacity: 1,
  },
  [MENU_ITEMS.UNDO]: {
    color: COLORS.BLACK,
    size: 1,
    opacity: 1,
  },
  [MENU_ITEMS.REDO]: {
    color: COLORS.BLACK,
    size: 1,
    opacity: 1,
  },
};

const toolboxSlice = createSlice({
  name: "toolbox",
  initialState,
  reducers: {
    changeColor: (state, action) => {
      state[action.payload.item].color = action.payload.color;
    },
    changeBrushSize: (state, action) => {
      state[action.payload.item].size = action.payload.size;
    },
    changeFontSize: (state, action) => {
      state[action.payload.item].size = action.payload.size;
    },
    changeOpacity: (state, action) => {
      state[action.payload.item].opacity = action.payload.opacity;
    },
    changeFill: (state, action) => {
      state[action.payload.item].fill = action.payload.fill;
    },
  },
});

export const {
  changeColor,
  changeBrushSize,
  changeFontSize,
  changeOpacity,
  changeFill,
} = toolboxSlice.actions;
export default toolboxSlice.reducer;
