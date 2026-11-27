import { useCallback, useEffect, useMemo } from "react";

export const useSelectionBridge = (board) => {
    const { applyElementUpdates, elements, onSelectionChange, registerSelectionUpdater, selectedElementIds, unlockedIds } = board;

    // The selection and its live style, so the bar's controls show it rather than tool defaults.
    // Memoised, so unrelated renders keep the same array and don't re-notify the parent.
    const selectedElements = useMemo(() => selectedElementIds.map((id) => elements[id]).filter(Boolean), [selectedElementIds, elements]);
    useEffect(() => {
        onSelectionChange?.(selectedElementIds, selectedElements);
    }, [selectedElementIds, selectedElements, onSelectionChange]);

    // A style edit from the bar commits like a drag: one repaint, one undo step, one emit per element.
    const updateSelectedElementsStyle = useCallback(
        (patch, options) => {
            const updatedById = {};
            unlockedIds(selectedElementIds).forEach((id) => {
                updatedById[id] = { ...elements[id], ...patch };
            });
            applyElementUpdates(updatedById, options);
        },
        [selectedElementIds, unlockedIds, elements, applyElementUpdates],
    );

    useEffect(() => {
        registerSelectionUpdater?.(updateSelectedElementsStyle);
    }, [registerSelectionUpdater, updateSelectedElementsStyle]);

    return {
        selectedElements,
    };
};
