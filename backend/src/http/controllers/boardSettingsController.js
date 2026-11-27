import logger from "../../observability/logger.js";
import Drawing from "../../models/drawingSchema.js";
import { ROLES } from "../../models/accessControl.js";
import { enforceLiveAccess } from "../../services/liveAccess.js";
import { listAgentTurns, undoAgentTurn, UndoRefused } from "../../services/agentActivity.js";

const DEFAULT_EMBED = { enabled: false, sites: [] };

const settingsOf = (drawing, role) => ({
    linkAccess: drawing.linkAccess ?? "none",
    agentAccess: drawing.agentAccess ?? "edit",
    embedEnabled: (drawing.embed ?? DEFAULT_EMBED).enabled,
    // Only the owner chooses, so only the owner sees, which sites may frame the board.
    ...(role === ROLES.OWNER ? { embed: drawing.embed ?? DEFAULT_EMBED } : {}),
});

const getSettings = (req, res) => res.status(200).json({ data: settingsOf(req.drawing, req.drawing.getRole(req.user)) });

const updateSettings = async (req, res) => {
    try {
        const { linkAccess, agentAccess, embed } = req.body;
        await Drawing.writeFields(req.drawing._id, { linkAccess, agentAccess, embed });
        const next = {
            ...req.drawing,
            linkAccess: linkAccess ?? req.drawing.linkAccess,
            agentAccess: agentAccess ?? req.drawing.agentAccess,
            embed: embed ?? req.drawing.embed,
        };
        await enforceLiveAccess(next);
        return res.status(200).json({ data: settingsOf(next, ROLES.OWNER) });
    } catch (error) {
        logger.error({ err: error, shareId: req.drawing.shareId }, "error updating board settings");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getAgentActivity = async (req, res) => {
    try {
        return res.status(200).json({ turns: await listAgentTurns(req.drawing.shareId) });
    } catch (error) {
        logger.error({ err: error, shareId: req.drawing.shareId }, "error listing agent activity");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const undoTurn = async (req, res) => {
    try {
        return res.status(200).json(await undoAgentTurn(req.drawing.shareId, req.params.turnId, { userId: req.user.userId }));
    } catch (error) {
        if (error instanceof UndoRefused) return res.status(error.status).json({ message: error.message });
        logger.error({ err: error, shareId: req.drawing.shareId }, "error undoing an agent turn");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getSettings, updateSettings, getAgentActivity, undoTurn };
