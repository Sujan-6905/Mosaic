import logger from "../../observability/logger.js";
import { isPushConfigured, pushPublicKey, removeSubscription, saveSubscription, SubscriptionHeldElsewhere } from "../../services/webPush.js";

// A personal access token isn't a browser, so only a browser sign-in can turn this on.
const isBrowserSignIn = (user) => typeof user.sid === "string" && !user.sid.startsWith("pat:");

// Null when this server has no push keys, so the browser offers nothing to turn on.
export const getPublicKey = (req, res) => res.status(200).json({ publicKey: pushPublicKey() });

export const subscribe = async (req, res) => {
    if (!isPushConfigured()) return res.status(503).json({ message: "Notifications aren't set up on this server." });
    if (!isBrowserSignIn(req.user)) return res.status(403).json({ message: "Turn notifications on from a browser signed in to Mosaic." });
    try {
        await saveSubscription(req.user.userId, req.user.sid, req.body);
        return res.status(201).json({ message: "This browser will be told about mentions." });
    } catch (error) {
        if (error instanceof SubscriptionHeldElsewhere) return res.status(409).json({ message: "This browser's notifications belong to another sign-in." });
        logger.error({ err: error }, "error saving a push subscription");
        return res.status(500).json({ message: "Couldn't turn notifications on. Try again." });
    }
};

export const unsubscribe = async (req, res) => {
    try {
        await removeSubscription(req.user.userId, req.body.endpoint);
        return res.status(204).end();
    } catch (error) {
        logger.error({ err: error }, "error removing a push subscription");
        return res.status(500).json({ message: "Couldn't turn notifications off. Try again." });
    }
};
