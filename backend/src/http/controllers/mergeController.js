import { applyMerge, MERGE_DIRECTIONS, MergeRefused, previewMerge } from "../../services/boardMerge.js";
import logger from "../../observability/logger.js";
import { markFirst } from "../../services/userActivity.js";

const handled = (work, failure) => async (req, res) => {
    try {
        return await work(req, res);
    } catch (error) {
        if (error instanceof MergeRefused) return res.status(error.status).json({ message: error.message });
        logger.error({ err: error }, failure);
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const previewMergeHandler = handled(async (req, res) => {
    const { direction } = req.query;
    if (!MERGE_DIRECTIONS.includes(direction)) return res.status(400).json({ message: `direction must be one of: ${MERGE_DIRECTIONS.join(", ")}` });
    return res.status(200).json(await previewMerge({ branchShareId: req.params.shareId, direction, caller: req.user }));
}, "error previewing a merge");

export const applyMergeHandler = handled(async (req, res) => {
    const { direction, choices, expectedTargetSeq } = req.body;
    const merged = await applyMerge({ branchShareId: req.params.shareId, direction, caller: req.user, choices, expectedTargetSeq });
    markFirst(req.user.userId, "firstMerge");
    return res.status(200).json(merged);
}, "error applying a merge");
