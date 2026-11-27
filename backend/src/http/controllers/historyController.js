import Drawing from "../../models/drawingSchema.js";
import { getUsername } from "../../services/boards.js";
import logger from "../../observability/logger.js";
import { getLatestSeq, reconstructStateAtSeq, getVersions, createNamedVersion, diffVersions } from "../../services/operationLog.js";

// Route middleware has already loaded req.drawing and checked access.
const getVersionsHandler = async (req, res) => {
    try {
        const versions = await getVersions(req.params.shareId);
        return res.status(200).json({ versions });
    } catch (error) {
        logger.error({ err: error }, "error fetching versions");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const previewVersionHandler = async (req, res) => {
    try {
        const seq = Number(req.params.seq);
        if (!Number.isInteger(seq) || seq < 0) {
            return res.status(400).json({ message: "seq must be a non-negative integer" });
        }
        const state = await reconstructStateAtSeq(req.params.shareId, seq);
        return res.status(200).json(state);
    } catch (error) {
        logger.error({ err: error }, "error previewing version");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const createVersionHandler = async (req, res) => {
    try {
        const { name } = req.body;
        const { userId } = req.user;
        const snapshot = await createNamedVersion(req.params.shareId, {
            name,
            authorId: userId,
            authorName: (await getUsername(userId)) ?? "Someone",
        });
        return res.status(201).json({ message: "Version created successfully", data: { seq: snapshot.seq, name: snapshot.name } });
    } catch (error) {
        logger.error({ err: error }, "error creating named version");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// The comparison board needs its own view-access check before it is reconstructed.
const diffHandler = async (req, res) => {
    try {
        const { shareId } = req.params;
        const compareShareId = req.query.compareShareId || shareId;
        const seq = req.query.seq !== undefined ? Number(req.query.seq) : await getLatestSeq(shareId);
        const compareSeq = req.query.compareSeq !== undefined ? Number(req.query.compareSeq) : await getLatestSeq(compareShareId);

        if (!Number.isInteger(seq) || !Number.isInteger(compareSeq)) {
            return res.status(400).json({ message: "seq and compareSeq must be integers" });
        }

        if (compareShareId !== shareId) {
            const compareDrawing = await Drawing.findOne({ shareId: compareShareId }).catch(() => null);
            if (!compareDrawing || !compareDrawing.hasViewAccess(req.user)) {
                return res.status(403).json({ message: "access forbidden on comparison board" });
            }
        }

        // A branch compared with its parent shows what the branch changed, whichever of the two is open.
        const fromParent = compareShareId === req.drawing?.parentShareId;
        const thisBoard = { shareId, seq };
        const otherBoard = { shareId: compareShareId, seq: compareSeq };
        const diff = fromParent ? await diffVersions(otherBoard, thisBoard) : await diffVersions(thisBoard, otherBoard);
        return res.status(200).json(diff);
    } catch (error) {
        logger.error({ err: error }, "error diffing versions");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getVersionsHandler, previewVersionHandler, createVersionHandler, diffHandler };
