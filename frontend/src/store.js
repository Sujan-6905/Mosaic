import { configureStore } from "@reduxjs/toolkit";
import menuSlice from "@/slice/menuSlice"
import toolboxSlice from "@/slice/toolboxSlice"
import headerSlice from "@/slice/headerSlice"

const store = configureStore({
    reducer: {
        menu: menuSlice,
        toolbox: toolboxSlice,
        header: headerSlice
    }
})

export default store;
