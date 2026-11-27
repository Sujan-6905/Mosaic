import Drawing from "../../models/drawingSchema.js";
import { buildWall, keepThousandth, readActivityYears } from "../../services/userActivity.js";
import logger from "../../observability/logger.js";

// The signed-in person's own year of work, for their Profile.
export const getActivityWall = async (req, res) => {
    try {
        const { userId } = req.user;
        const now = new Date();
        const year = now.getUTCFullYear();
        const [{ rows }, docs] = await Promise.all([
            Drawing.find({ owner: userId }, { select: ["createdAt", "deletedAt"] }),
            readActivityYears(userId, [year - 1, year]),
        ]);
        const wall = buildWall(docs, { now, ownedBoards: rows.filter((board) => !board.deletedAt) });
        await keepThousandth(wall, docs, userId, now);
        return res.status(200).json(wall);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.userId }, "error loading the wall");
        return res.status(500).json({ message: "Internal server error." });
    }
};
