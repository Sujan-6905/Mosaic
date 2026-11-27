import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { wordsOf } from "../../../../../shared/canvas/elements/elementWords.js";

export const FIND_INPUT_ID = "board-find-input";

// Elements whose words contain the query, in reading order: top to bottom,
// then left to right, so "next" walks the board the way a person reads it.
export const findOnBoard = (elements, query) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return Object.entries(elements)
        .filter(([, element]) => wordsOf(element).toLowerCase().includes(needle))
        .map(([id, element]) => ({ id, bounds: getElementBounds(element) }))
        .filter(({ bounds }) => bounds)
        .sort((a, b) => a.bounds.minY - b.bounds.minY || a.bounds.minX - b.bounds.minX)
        .map(({ id }) => id);
};
