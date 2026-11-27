import { configureStore } from "@reduxjs/toolkit";
import menuSlice from "./menuSlice";
import toolboxSlice from "./toolboxSlice";
import headerSlice from "./headerSlice";
import connectionSlice from "./connectionSlice";

const store = configureStore({
    reducer: {
        menu: menuSlice,
        toolbox: toolboxSlice,
        header: headerSlice,
        connection: connectionSlice,
    },
});

export default store;
