import {
    alignBottom,
    alignHCenter,
    alignLeft,
    alignRight,
    alignTop,
    alignVCenter,
    distributeHorizontal,
    distributeVertical,
} from "../../../../../shared/canvas/geometry/alignment";
import { bringForward, bringToFront, sendBackward, sendToBack } from "../../../../../shared/canvas/editing/zOrder";
import { useEffect } from "react";

export const useSelectionActions = (board) => {
    const {
        applyAlignmentCommand,
        applyZOrderCommand,
        catchUp,
        copyStyle,
        duplicateSelection,
        groupSelection,
        pasteStyle,
        registerSelectionActions,
        removeElements,
        selectedElementIds,
        setArchitectureOpen,
        setMermaidOpen,
        setPiecesOpen,
        setRestyleOpen,
        tidyUpSelection,
        toggleLockSelection,
        ungroupSelection,
    } = board;

    // Hands the selection bar the same actions as the shortcuts, as one stable object.
    useEffect(() => {
        registerSelectionActions?.({
            group: groupSelection,
            ungroup: ungroupSelection,
            bringToFront: () => applyZOrderCommand(bringToFront),
            bringForward: () => applyZOrderCommand(bringForward),
            sendBackward: () => applyZOrderCommand(sendBackward),
            sendToBack: () => applyZOrderCommand(sendToBack),
            toggleLock: toggleLockSelection,
            duplicate: duplicateSelection,
            alignLeft: () => applyAlignmentCommand(alignLeft),
            alignHCenter: () => applyAlignmentCommand(alignHCenter),
            alignRight: () => applyAlignmentCommand(alignRight),
            alignTop: () => applyAlignmentCommand(alignTop),
            alignVCenter: () => applyAlignmentCommand(alignVCenter),
            alignBottom: () => applyAlignmentCommand(alignBottom),
            distributeHorizontal: () => applyAlignmentCommand(distributeHorizontal),
            distributeVertical: () => applyAlignmentCommand(distributeVertical),
            tidyUp: tidyUpSelection,
            remove: () => removeElements(selectedElementIds),
            copyStyle,
            pasteStyle,
            openArchitecture: () => {
                catchUp.close();
                setArchitectureOpen(true);
            },
            openMermaid: () => setMermaidOpen(true),
            openPieces: () => {
                catchUp.close();
                setArchitectureOpen(false);
                setRestyleOpen(false);
                setPiecesOpen(true);
            },
            openRestyle: () => {
                catchUp.close();
                setArchitectureOpen(false);
                setPiecesOpen(false);
                setRestyleOpen(true);
            },
        });
    }, [
        registerSelectionActions,
        removeElements,
        selectedElementIds,
        groupSelection,
        ungroupSelection,
        applyZOrderCommand,
        toggleLockSelection,
        duplicateSelection,
        applyAlignmentCommand,
        tidyUpSelection,
        copyStyle,
        pasteStyle,
        catchUp,
        setArchitectureOpen,
        setMermaidOpen,
        setPiecesOpen,
        setRestyleOpen,
    ]);
};
