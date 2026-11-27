import { createSlice } from "@reduxjs/toolkit";

const connectionSlice = createSlice({
    name: "connection",
    initialState: { isConnected: false, backendStatus: "checking" },
    reducers: {
        setConnected: (state, action) => {
            state.isConnected = action.payload;
        },
        setBackendStatus: (state, action) => {
            state.backendStatus = action.payload;
        },
    },
});

export const { setConnected, setBackendStatus } = connectionSlice.actions;
export default connectionSlice.reducer;
