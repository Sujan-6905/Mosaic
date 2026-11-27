import Drawing from "../../models/drawingSchema.js";
import { callerId, isSwept } from "../../models/accessControl.js";
import logger from "../../observability/logger.js";
import { nullIfMissing } from "../../db/errors.js";

const findDrawing = (query) => nullIfMissing(() => (typeof query === "object" ? Drawing.findOne(query) : Drawing.findById(query)));

const checkEditAccess = async (req, res, next) => {
    try {
        const { drawingId, shareId } = req.params;

        let drawing = drawingId ? await findDrawing(drawingId) : null;
        if (!drawing && shareId) {
            drawing = await findDrawing({ shareId });
        }

        if (!drawing) {
            return res.status(404).json({ message: "drawing not found" });
        }

        const hasEditAccess = drawing.hasEditAccess(req.user);

        if (!hasEditAccess) {
            return res.status(403).json({ message: "user does not have edit permission" });
        }

        // Downstream handlers reuse this instead of re-fetching by id/shareId.
        req.drawing = drawing;
        next();
    } catch (error) {
        logger.error({ err: error }, "error checking edit access");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// The floor every collaborator clears: read-only history, replay and branch routes, and fork.
const checkViewAccess = async (req, res, next) => {
    try {
        const { drawingId, shareId } = req.params;

        let drawing = drawingId ? await findDrawing(drawingId) : null;
        if (!drawing && shareId) {
            drawing = await findDrawing({ shareId });
        }

        if (!drawing) {
            return res.status(404).json({ message: "drawing not found" });
        }

        if (!drawing.hasViewAccess(req.user)) {
            return res.status(403).json({ message: "user does not have view permission" });
        }

        req.drawing = drawing;
        next();
    } catch (error) {
        logger.error({ err: error }, "error checking view access");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const checkDeleteAccess = async (req, res, next) => {
    try {
        const { drawingId, shareId } = req.params;

        let drawing = drawingId ? await findDrawing(drawingId) : null;
        if (!drawing && shareId) {
            drawing = await findDrawing({ shareId });
        }

        if (!drawing) {
            return res.status(404).json({ message: "drawing not found" });
        }

        const hasDeleteAccess = drawing.hasDeleteAccess(req.user);

        if (!hasDeleteAccess) {
            return res.status(403).json({ message: "user does not have delete permission" });
        }

        // Downstream handlers reuse this instead of re-fetching by id/shareId.
        req.drawing = drawing;
        next();
    } catch (error) {
        logger.error({ err: error }, "error checking delete access");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Only the owner reaches a swept board, to put it back or purge it; to everyone else it does not exist.
const checkSweptOwner = async (req, res, next) => {
    try {
        const drawing = await findDrawing(req.params.drawingId);
        if (!drawing || !isSwept(drawing) || drawing.owner !== callerId(req.user)) {
            return res.status(404).json({ message: "no swept board here" });
        }
        req.drawing = drawing;
        next();
    } catch (error) {
        logger.error({ err: error }, "error checking a swept board");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { checkEditAccess, checkViewAccess, checkDeleteAccess, checkSweptOwner };
