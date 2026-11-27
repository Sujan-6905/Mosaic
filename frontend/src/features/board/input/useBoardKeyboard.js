import { isClosedShape } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { MENU_ITEMS, SHORTCUT_KEY_TO_MENU_ITEM } from "../tools/toolSettings";
import { bringForward, bringToFront, sendBackward, sendToBack } from "../../../../../shared/canvas/editing/zOrder";
import { alignBottom, alignLeft, alignRight, alignTop } from "../../../../../shared/canvas/geometry/alignment";
import { panByScreenDelta } from "../camera/camera";
import { FIND_INPUT_ID } from "../text/boardFind";
import { FONT_SIZE_PRESETS } from "../tools/toolSettings";

const ALIGN_FOR_KEY = { ArrowLeft: alignLeft, ArrowRight: alignRight, ArrowUp: alignTop, ArrowDown: alignBottom };
const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

const nextFontSize = (size, larger) =>
    larger ? (FONT_SIZE_PRESETS.find((preset) => preset > size) ?? size) : ([...FONT_SIZE_PRESETS].reverse().find((preset) => preset < size) ?? size);
import { menuItemClick } from "@/store/menuSlice";
import { useEffect } from "react";

export const useBoardKeyboard = (board) => {
    const {
        applyAlignmentCommand,
        applyElementUpdates,
        cycleShapeKind,
        growFlowchart,
        selectConnectedToward,
        setBoardPropertiesOpen,
        setCamera,
        setPiecesOpen,
        viewportSize,
        copyStyle,
        cutSelection,
        elements,
        flipSelection,
        handlePasteShortcut,
        handleZoomIn,
        handleZoomOut,
        handleZoomReset,
        handleZoomToFit,
        handleZoomToSelection,
        openTextEditor,
        pasteClipboardInPlace,
        pasteStyle,
        spaceHeldRef,
        activeMenuItem,
        applyZOrderCommand,
        commentsPanelOpen,
        copySelection,
        dispatch,
        duplicateSelection,
        setCommentsPanelOpen,
        groupSelection,
        nudgeSelection,
        performRedo,
        performUndo,
        removeElements,
        settleTransientEdits,
        selectedElementIds,
        setCommandPaletteOpen,
        setSelectedElementIds,
        toggleLockSelection,
        ungroupSelection,
        setHelpOpen,
        copyAsPng,
        setFindOpen,
    } = board;

    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setCommandPaletteOpen((prev) => !prev);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    performRedo();
                } else {
                    performUndo();
                }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setFindOpen(true);
                document.getElementById(FIND_INPUT_ID)?.select();
                return;
            }

            if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                setHelpOpen("shortcuts");
                return;
            }

            // By code, since Alt changes the character a key types on a Mac.
            if (e.shiftKey && e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
                e.preventDefault();
                copyAsPng();
                return;
            }

            if (e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === "y") {
                e.preventDefault();
                performRedo();
                return;
            }

            // Paste needs no selection, so it comes before that check. No preventDefault: the browser's paste event
            // carries the clipboard's pictures and text, which the shortcut can't read.
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "v") {
                e.preventDefault();
                pasteClipboardInPlace();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "v") {
                handlePasteShortcut();
                return;
            }

            // The board's own zoom rather than the browser's, which would scale the toolbars too.
            if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+" || e.key === "-")) {
                e.preventDefault();
                if (e.key === "-") handleZoomOut();
                else handleZoomIn();
                return;
            }
            // By physical key, since Shift turns the digit into a symbol.
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && ["Digit0", "Digit1", "Digit2"].includes(e.code)) {
                e.preventDefault();
                if (e.code === "Digit0") handleZoomReset();
                else if (e.code === "Digit1") handleZoomToFit();
                else if (selectedElementIds.length > 0) handleZoomToSelection();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                e.preventDefault();
                dispatch(menuItemClick(MENU_ITEMS.SELECT));
                setSelectedElementIds(Object.keys(elements).filter((id) => !elements[id].locked));
                return;
            }

            if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "Slash") {
                e.preventDefault();
                setBoardPropertiesOpen((open) => !open);
                return;
            }
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "p") {
                e.preventDefault();
                setPiecesOpen((open) => !open);
                return;
            }
            if (e.key === "PageUp" || e.key === "PageDown") {
                e.preventDefault();
                const distance = (e.key === "PageUp" ? 1 : -1) * (e.shiftKey ? viewportSize.width : viewportSize.height) * 0.8;
                setCamera((camera) => panByScreenDelta(camera, e.shiftKey ? distance : 0, e.shiftKey ? 0 : distance));
                return;
            }

            if (e.code === "Space" && !e.repeat) {
                e.preventDefault();
                spaceHeldRef.current = true;
                return;
            }

            if (e.key === "Escape" && activeMenuItem !== MENU_ITEMS.SELECT) {
                dispatch(menuItemClick(MENU_ITEMS.SELECT));
                return;
            }

            if (e.key === "Escape" && commentsPanelOpen && selectedElementIds.length === 0) {
                setCommentsPanelOpen(false);
                return;
            }

            if (activeMenuItem === MENU_ITEMS.SELECT && selectedElementIds.length > 0) {
                // Shift turns ] into } and [ into {, so both forms are checked.
                if ((e.ctrlKey || e.metaKey) && (e.key === "]" || e.key === "}")) {
                    e.preventDefault();
                    applyZOrderCommand(e.shiftKey ? bringToFront : bringForward);
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && (e.key === "[" || e.key === "{")) {
                    e.preventDefault();
                    applyZOrderCommand(e.shiftKey ? sendToBack : sendBackward);
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
                    e.preventDefault();
                    if (e.shiftKey) ungroupSelection();
                    else groupSelection();
                    return;
                }
                // With Shift, because the browser keeps Ctrl+L for its address bar.
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
                    e.preventDefault();
                    toggleLockSelection();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
                    e.preventDefault();
                    duplicateSelection();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "c") {
                    e.preventDefault();
                    copyStyle();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "v") {
                    e.preventDefault();
                    pasteStyle();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
                    e.preventDefault();
                    copySelection();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
                    e.preventDefault();
                    cutSelection();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && ARROW_KEYS.includes(e.key)) {
                    e.preventDefault();
                    if (selectedElementIds.length > 1) applyAlignmentCommand(ALIGN_FOR_KEY[e.key]);
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ARROW_KEYS.includes(e.key)) {
                    e.preventDefault();
                    growFlowchart(e.key);
                    return;
                }
                if (e.altKey && !e.ctrlKey && !e.metaKey && ARROW_KEYS.includes(e.key)) {
                    e.preventDefault();
                    selectConnectedToward(e.key);
                    return;
                }
                if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey && cycleShapeKind(e.shiftKey)) {
                    e.preventDefault();
                    return;
                }
                // By physical key, since Shift turns "," and "." into "<" and ">".
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === "Comma" || e.code === "Period")) {
                    e.preventDefault();
                    const larger = e.code === "Period";
                    applyElementUpdates(
                        Object.fromEntries(
                            selectedElementIds
                                .filter((id) => elements[id] && !elements[id].locked && ["text", "sticky", "shape", "connector"].includes(elements[id].type))
                                .map((id) => {
                                    const element = elements[id];
                                    const field = element.type === "text" || element.type === "sticky" ? "size" : "fontSize";
                                    return [id, { ...element, [field]: nextFontSize(element[field] || 16, larger) }];
                                }),
                        ),
                        { transient: true },
                    );
                    return;
                }
                if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.toLowerCase() === "h" || e.key.toLowerCase() === "v")) {
                    e.preventDefault();
                    flipSelection(e.key.toLowerCase() === "h" ? "x" : "y");
                    return;
                }
                if (e.key === "Enter" && selectedElementIds.length === 1) {
                    const only = elements[selectedElementIds[0]];
                    if (only && (only.type === "text" || only.type === "sticky" || only.type === "connector" || only.type === "table" || isClosedShape(only))) {
                        e.preventDefault();
                        openTextEditor(selectedElementIds[0]);
                        return;
                    }
                }
                if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    removeElements(selectedElementIds);
                    return;
                }
                if (e.key === "Escape") {
                    setSelectedElementIds([]);
                    return;
                }
                // Arrows nudge with no modifier, so they never shadow a browser shortcut; Shift moves further.
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    const step = e.shiftKey ? 10 : 1;
                    const deltas = {
                        ArrowUp: [0, -step],
                        ArrowDown: [0, step],
                        ArrowLeft: [-step, 0],
                        ArrowRight: [step, 0],
                    };
                    const [dx, dy] = deltas[e.key];
                    nudgeSelection(dx, dy);
                    return;
                }
            }

            // Single-key tools as the dock's tooltips show them, never with a modifier held.
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const tool = SHORTCUT_KEY_TO_MENU_ITEM[e.key.toLowerCase()];
                if (tool) {
                    e.preventDefault();
                    dispatch(menuItemClick(tool));
                }
            }
        };
        const handleKeyUp = (e) => {
            if (e.code === "Space") spaceHeldRef.current = false;
            settleTransientEdits();
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", settleTransientEdits);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", settleTransientEdits);
        };
    }, [
        performUndo,
        performRedo,
        activeMenuItem,
        commentsPanelOpen,
        setCommentsPanelOpen,
        selectedElementIds,
        removeElements,
        groupSelection,
        ungroupSelection,
        applyZOrderCommand,
        toggleLockSelection,
        duplicateSelection,
        copySelection,
        copyStyle,
        cutSelection,
        elements,
        handlePasteShortcut,
        pasteClipboardInPlace,
        flipSelection,
        applyAlignmentCommand,
        applyElementUpdates,
        cycleShapeKind,
        growFlowchart,
        selectConnectedToward,
        setBoardPropertiesOpen,
        setCamera,
        setPiecesOpen,
        viewportSize,
        handleZoomIn,
        handleZoomOut,
        handleZoomReset,
        handleZoomToFit,
        handleZoomToSelection,
        openTextEditor,
        pasteStyle,
        spaceHeldRef,
        nudgeSelection,
        settleTransientEdits,
        dispatch,
        setCommandPaletteOpen,
        setSelectedElementIds,
        setHelpOpen,
        copyAsPng,
        setFindOpen,
    ]);

    // The selection clears whenever another tool is picked, so no stale handles linger.
    useEffect(() => {
        if (activeMenuItem !== MENU_ITEMS.SELECT) {
            setSelectedElementIds([]);
        }
    }, [activeMenuItem, setSelectedElementIds]);
};
