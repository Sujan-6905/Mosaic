// One logged change applied to a board state ({ elements, background }), in place.
export const applyOperation = (state, op) => {
    if (op.opType === "delete") delete state.elements[op.elementId];
    else if (op.opType === "background") state.background = op.after;
    else state.elements[op.elementId] = op.after;
    return state;
};

export const DEFAULT_BACKGROUND = { type: "blank", colorToken: null };
