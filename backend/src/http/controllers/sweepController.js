import { restoreBoard, sweepBoard } from "../../services/boardSweep.js";
import { removeBoard } from "../../services/boards.js";
import logger from "../../observability/logger.js";

const respond = (action, message) => async (req, res) => {
    try {
        await action(req.drawing);
        return res.status(200).json({ message });
    } catch (error) {
        logger.error({ err: error, drawingId: req.params?.drawingId }, `error: ${message}`);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const sweepDrawing = respond((drawing) => sweepBoard({ _id: drawing._id, shareId: drawing.shareId }), "board swept");
const restoreDrawing = respond((drawing) => restoreBoard(drawing._id), "board put back");
const purgeDrawing = respond((drawing) => removeBoard({ _id: drawing._id, shareId: drawing.shareId }), "board purged");

export { sweepDrawing, restoreDrawing, purgeDrawing };
