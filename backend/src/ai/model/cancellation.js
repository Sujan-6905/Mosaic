// Aborts an in-flight turn by its own id; a tab's correlation id is shared by all its requests,
// so it can't name one turn.
const controllers = new Map(); // turnId -> AbortController

export const registerTurn = (turnId) => {
    const controller = new AbortController();
    controllers.set(turnId, controller);
    return controller;
};

export const clearTurn = (turnId) => {
    controllers.delete(turnId);
};

// Whether a live turn was found; used only to log stale cancels.
export const cancelTurn = (turnId) => {
    const controller = controllers.get(turnId);
    if (!controller) return false;
    controller.abort();
    controllers.delete(turnId);
    return true;
};
