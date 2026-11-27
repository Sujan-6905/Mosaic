import logger from "../../observability/logger.js";
import Drawing from "../../models/drawingSchema.js";
import { nullIfMissing } from "../../db/errors.js";
import { createPersonalToken, listPersonalTokens, revokePersonalToken, personalTokensAllowed } from "../../auth/personalTokens.js";
import { listGrants, endSessionById, ownerOfSession } from "../../auth/sessionTokens.js";

const failed = (res, error, message) => {
    logger.error({ err: error }, message);
    return res.status(500).json({ message: "Internal server error." });
};

const listTokens = async (req, res) => {
    try {
        return res.status(200).json({ tokens: await listPersonalTokens(req.user.userId), allowed: personalTokensAllowed() });
    } catch (error) {
        return failed(res, error, "error listing personal tokens");
    }
};

// A token limited to boards may name only boards its creator can open.
const createToken = async (req, res) => {
    if (!personalTokensAllowed()) return res.status(403).json({ message: "Personal access tokens are switched off on this server." });
    try {
        const { name, scope, boards, days } = req.body;
        for (const shareId of boards ?? []) {
            const drawing = await nullIfMissing(() => Drawing.findOne({ shareId }));
            if (!drawing?.hasViewAccess(req.user)) return res.status(400).json({ message: `You don't have access to board ${shareId}.` });
        }
        const created = await createPersonalToken(req.user.userId, { name, scope, boards, days });
        if (created.error) return res.status(409).json({ message: created.error });
        return res.status(201).json({ token: created });
    } catch (error) {
        return failed(res, error, "error creating a personal token");
    }
};

const revokeToken = async (req, res) => {
    try {
        const revoked = await revokePersonalToken(req.user.userId, req.params.tokenId);
        return revoked ? res.status(204).end() : res.status(404).json({ message: "No such token." });
    } catch (error) {
        return failed(res, error, "error revoking a personal token");
    }
};

const listAgents = async (req, res) => {
    try {
        return res.status(200).json({ agents: await listGrants(req.user.userId) });
    } catch (error) {
        return failed(res, error, "error listing connected agents");
    }
};

const disconnectAgent = async (req, res) => {
    try {
        if ((await ownerOfSession(req.params.grantId)) !== req.user.userId) return res.status(404).json({ message: "No such connected agent." });
        await endSessionById(req.params.grantId);
        return res.status(204).end();
    } catch (error) {
        return failed(res, error, "error disconnecting an agent");
    }
};

export { listTokens, createToken, revokeToken, listAgents, disconnectAgent };
