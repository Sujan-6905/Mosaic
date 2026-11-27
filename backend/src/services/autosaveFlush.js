import { SAVE_RESULT } from "./boards.js";
import { recordSaveFailure } from "../observability/metrics.js";
import { sendAlert } from "../observability/alerts.js";
import logger from "../observability/logger.js";

// SPOP on the shared dirty set means two instances never flush one board. Failures are
// re-marked after draining, so retries wait for the next tick.
export const flushDirtyBoards = async ({ canvasStore, flushRoom, onSaved, onBoardGone }) => {
    const failed = [];
    for (;;) {
        const shareId = await canvasStore.popDirty();
        if (!shareId) break;

        try {
            const result = await flushRoom(shareId);
            if (result === SAVE_RESULT.SAVED) {
                await onSaved?.(shareId);
            } else if (result === SAVE_RESULT.BOARD_GONE) {
                await onBoardGone(shareId);
            } else if (result !== SAVE_RESULT.NOTHING_TO_SAVE) {
                recordSaveFailure();
                failed.push(shareId);
            }
        } catch (error) {
            recordSaveFailure();
            logger.error({ err: error, shareId }, "autosave flush failed for room");
            sendAlert("save-failure", { shareId, error: error.message });
            failed.push(shareId);
        }
    }
    await Promise.all(failed.map((shareId) => canvasStore.markDirty(shareId)));
};
