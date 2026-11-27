import { useCallback } from "react";
import { generateElementId } from "../state/boardHelpers";
import { restyleSelection } from "./diagramStyles";

// Replaces the selected diagram with its restyled drawing in one undo step and selects the new one.
export const useDiagramRestyle = (board) => {
    const { elements, selectedElementIds, addGeneratedElements, setSelectedElementIds } = board;

    const restyleSelected = useCallback(
        (change) => {
            const result = restyleSelection({ elements, ids: selectedElementIds, recipe: change, generateElementId });
            if (!result) return;
            // The redrawn diagram keeps its place in the stacking order among other objects.
            const lowest = Math.min(...result.removeIds.map((id) => elements[id]?.zIndex ?? 0));
            const placed = result.elements.map(({ elementId, element }) => ({ elementId, element: { ...element, zIndex: lowest + element.zIndex / 1000 } }));
            addGeneratedElements(placed, { replacing: result.removeIds });
            setSelectedElementIds(placed.map(({ elementId }) => elementId));
        },
        [elements, selectedElementIds, addGeneratedElements, setSelectedElementIds],
    );

    return { restyleSelected };
};
