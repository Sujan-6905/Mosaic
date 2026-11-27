import Drawing from "../../models/drawingSchema.js";
import { nullIfMissing } from "../../db/errors.js";
import logger from "../../observability/logger.js";
import { getUsername } from "../../services/boards.js";
import { hasPendingRequest, listNotifications, markNotificationsRead, notify } from "../../services/notifications.js";

const getNotifications = async (req, res) => {
    try {
        return res.status(200).json(await listNotifications(req.user.userId));
    } catch (error) {
        logger.error({ err: error, userId: req.user.userId }, "error listing notifications");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const readNotifications = async (req, res) => {
    try {
        await markNotificationsRead(req.user.userId, req.body.ids ?? null);
        return res.status(204).end();
    } catch (error) {
        logger.error({ err: error, userId: req.user.userId }, "error marking notifications read");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Someone holding a link to a board they can't open asks its owner in.
// The answer never says more about the board than the "no access" screen already did.
const requestAccess = async (req, res) => {
    try {
        const { userId } = req.user;
        const drawing = await nullIfMissing(() => Drawing.findOne({ shareId: req.params.shareId }));
        if (!drawing) return res.status(404).json({ message: "This board doesn't exist." });
        if (drawing.getRole(userId)) return res.status(409).json({ message: "You can already open this board.", code: "has_access" });
        if (!(await hasPendingRequest(drawing.owner, userId, drawing.shareId))) {
            await notify(drawing.owner, {
                kind: "accessRequest",
                shareId: drawing.shareId,
                boardTitle: drawing.title,
                actorId: userId,
                actorName: await getUsername(userId),
            });
        }
        return res.status(202).json({ message: "The owner has been asked." });
    } catch (error) {
        logger.error({ err: error, shareId: req.params.shareId }, "error requesting board access");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getNotifications, readNotifications, requestAccess };
