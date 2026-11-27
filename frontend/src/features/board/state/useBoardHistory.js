import { MENU_ITEMS } from "../tools/toolSettings";
import { actionItemClick } from "@/store/menuSlice";
import { useCallback, useEffect } from "react";

export const useBoardHistory = (board) => {
    const {
        actionMenuItem,
        dispatch,
        elements,
        emitCanvasUpdate,
        enqueueStaticInsert,
        pushRedoEntry,
        pushUndoEntry,
        redoStackRef,
        requestStaticFullRepaint,
        roomJoined,
        setElements,
        setRedoStack,
        setUndoStack,
        shareId,
        showToast,
        spatialIndexRef,
        undoStackRef,
    } = board;

    // Applies the entry's snapshot, never the live element, so others' edits can't corrupt it.
    // A batch applies its steps in order to redo and in reverse to undo.
    const applyHistoryEntry = useCallback(
        (entry, direction) => {
            if (entry.type === "batch") {
                const ops = direction === "undo" ? [...entry.ops].reverse() : entry.ops;
                ops.forEach((op) => applyHistoryEntry(op, direction));
                return;
            }

            const isRemoval = (direction === "undo" && entry.type === "insert") || (direction === "redo" && entry.type === "delete");

            if (isRemoval) {
                if (elements[entry.elementId] === undefined) return;
                spatialIndexRef.current.remove(entry.elementId);
                setElements((prev) => {
                    const next = { ...prev };
                    delete next[entry.elementId];
                    requestStaticFullRepaint(next);
                    return next;
                });
                if (roomJoined && shareId) {
                    emitCanvasUpdate({ shareId, operation: "delete", elementId: entry.elementId });
                }
                return;
            }

            const snapshot = direction === "undo" ? entry.before : entry.after;
            // An update changes an element that exists either way; an insert or delete recreates one that's gone.
            const operation = entry.type === "update" ? "update" : "insert";
            // An update has stale pixels to erase and repaints in full; a recreated element just draws.
            if (operation === "update") spatialIndexRef.current.update(entry.elementId, snapshot);
            setElements((prev) => {
                const next = { ...prev, [entry.elementId]: snapshot };
                if (operation === "update") requestStaticFullRepaint(next);
                return next;
            });
            if (operation !== "update") {
                enqueueStaticInsert(entry.elementId, snapshot);
            }
            if (roomJoined && shareId) {
                emitCanvasUpdate({
                    shareId,
                    operation,
                    elementId: entry.elementId,
                    element: snapshot,
                });
            }
        },
        [elements, roomJoined, shareId, emitCanvasUpdate, requestStaticFullRepaint, enqueueStaticInsert, setElements, spatialIndexRef],
    );

    // Pops the ref before applying, so a repeated Ctrl+Z in the same tick takes the next entry, not this one again.
    const performUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) {
            showToast?.info("Nothing to Undo", "No more actions to undo");
            return;
        }
        const entry = undoStackRef.current[undoStackRef.current.length - 1];
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        setUndoStack(undoStackRef.current);
        applyHistoryEntry(entry, "undo");
        pushRedoEntry(entry);
    }, [applyHistoryEntry, showToast, pushRedoEntry, setUndoStack, undoStackRef]);

    const performRedo = useCallback(() => {
        if (redoStackRef.current.length === 0) {
            showToast?.info("Nothing to Redo", "No more actions to redo");
            return;
        }
        const entry = redoStackRef.current[redoStackRef.current.length - 1];
        redoStackRef.current = redoStackRef.current.slice(0, -1);
        setRedoStack(redoStackRef.current);
        applyHistoryEntry(entry, "redo");
        pushUndoEntry(entry);
    }, [applyHistoryEntry, showToast, pushUndoEntry, redoStackRef, setRedoStack]);

    useEffect(() => {
        if (!actionMenuItem) return;
        switch (actionMenuItem) {
            case MENU_ITEMS.UNDO:
                performUndo();
                break;
            case MENU_ITEMS.REDO:
                performRedo();
                break;
            default:
                break;
        }
        dispatch(actionItemClick(null));
    }, [actionMenuItem, performUndo, performRedo, dispatch]);

    return {
        performRedo,
        performUndo,
    };
};
