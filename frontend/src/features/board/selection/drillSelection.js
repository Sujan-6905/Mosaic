// What a double-click selects, given the elements under the pointer (largest first) and the selection before it.
// Each double-click steps one level inward; only the innermost goes on to edit its words.
export const nextDrillStep = (stack, previousSelection, topHitId) => {
    if (previousSelection.length > 1) {
        const member = stack.find((id) => previousSelection.includes(id));
        if (member) return { select: member };
    }
    if (previousSelection.length === 1) {
        const depth = stack.indexOf(previousSelection[0]);
        if (depth !== -1) return depth + 1 < stack.length ? { select: stack[depth + 1] } : { edit: stack[depth] };
    }
    return topHitId ? { edit: topHitId } : null;
};
