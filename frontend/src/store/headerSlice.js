import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    actionHeaderItem: null,
};

const headerSlice = createSlice({
    name: "header",
    initialState,
    reducers: {
        headerItemClick: (state, action) => {
            state.actionHeaderItem = action.payload;
        },
    },
});

export const { headerItemClick } = headerSlice.actions;
export default headerSlice.reducer;
