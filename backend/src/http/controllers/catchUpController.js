import { loadCatchUpDigest } from "../../catchup/loadCatchUp.js";
import { isDigestEmpty } from "../../catchup/digest.js";
import { summarizeDigest } from "../../catchup/summarizeDigest.js";
import logger from "../../observability/logger.js";

const parseSince = (raw) => {
    if (raw === undefined) return { since: null };
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? { invalid: true } : { since: parsed.toISOString() };
};

const getCatchUp = async (req, res) => {
    const { since, invalid } = parseSince(req.query.since);
    if (invalid) return res.status(400).json({ message: "since must be a date" });
    try {
        const digest = await loadCatchUpDigest({ shareId: req.params.shareId, drawing: req.drawing, userId: req.user.userId, since });
        return res.status(200).json({ digest: digest && !isDigestEmpty(digest) ? digest : null });
    } catch (error) {
        logger.error({ err: error, shareId: req.params.shareId }, "error building catch-up");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const summarizeCatchUp = async (req, res) => {
    const { since } = req.body;
    const { shareId } = req.params;
    const { userId } = req.user;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "The assistant isn't available right now." });

    try {
        const digest = await loadCatchUpDigest({ shareId, drawing: req.drawing, userId, since });
        if (!digest || isDigestEmpty(digest)) return res.status(200).json({ summary: null });
        const summary = await summarizeDigest({ apiKey, digest });
        return res.status(200).json({ summary });
    } catch (error) {
        logger.error({ err: error, shareId, providerCode: error.providerCode }, "catch-up summary failed");
        return res.status(502).json({ message: "Couldn't write a summary just now. The list of changes is still accurate." });
    }
};

export { getCatchUp, summarizeCatchUp };
