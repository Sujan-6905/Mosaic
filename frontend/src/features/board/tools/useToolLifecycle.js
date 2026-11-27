import { MENU_ITEMS } from "./toolSettings";
import { menuItemClick, setToolLocked } from "@/store/menuSlice";
import { useCallback, useEffect } from "react";
import { useSelector } from "react-redux";

const TOOL_LOCK_KEY = "mosaic:toolLock";

const readToolLockPreference = () => {
    try {
        return window.localStorage.getItem(TOOL_LOCK_KEY) === "1";
    } catch {
        return false;
    }
};

export const saveToolLockPreference = (locked) => {
    try {
        window.localStorage.setItem(TOOL_LOCK_KEY, locked ? "1" : "0");
    } catch {
        // Private windows can refuse storage; the lock then lasts this page only.
    }
};

// A one-shot tool hands back to Select with what it just made selected, ready
// to style, unless the tool is locked for drawing several in a row.
export const useToolLifecycle = (board) => {
    const { dispatch, setSelectedElementIds } = board;
    const toolLocked = useSelector((state) => state.menu.toolLocked);

    useEffect(() => {
        dispatch(setToolLocked(readToolLockPreference()));
    }, [dispatch]);

    const finishToolUse = useCallback(
        (elementIds) => {
            if (toolLocked) return;
            dispatch(menuItemClick(MENU_ITEMS.SELECT));
            setSelectedElementIds(elementIds);
        },
        [toolLocked, dispatch, setSelectedElementIds],
    );

    return { finishToolUse, toolLocked };
};
