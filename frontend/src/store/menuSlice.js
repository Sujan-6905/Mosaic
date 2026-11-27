import { createSlice } from "@reduxjs/toolkit";
import { MENU_ITEMS } from "@/features/board/tools/toolSettings";

const initialState = {
    activeMenuItem: MENU_ITEMS.SELECT,
    actionMenuItem: null,
    toolLocked: false,
};

const menuSlice = createSlice({
    name: "menu",
    initialState,
    reducers: {
        menuItemClick: (state, action) => {
            state.activeMenuItem = action.payload;
        },
        actionItemClick: (state, action) => {
            state.actionMenuItem = action.payload;
        },
        setToolLocked: (state, action) => {
            state.toolLocked = action.payload;
        },
    },
});

export const { menuItemClick, actionItemClick, setToolLocked } = menuSlice.actions;
export default menuSlice.reducer;
