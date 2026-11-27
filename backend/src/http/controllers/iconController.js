import { ICON_SETS, iconFor, isIconSet, searchIcons } from "../../services/iconLibrary.js";
import logger from "../../observability/logger.js";

const MAX_QUERY_LENGTH = 60;

export const listIconSetsHandler = (req, res) => res.status(200).json({ sets: ICON_SETS });

export const searchIconsHandler = (req, res) => {
    try {
        const query = String(req.query.q ?? "").slice(0, MAX_QUERY_LENGTH);
        const sets = req.query.set ? String(req.query.set).split(",").filter(isIconSet) : undefined;
        const limit = Math.max(1, Math.min(120, Number(req.query.limit) || 60));
        return res.status(200).json(searchIcons({ query, sets, limit }));
    } catch (error) {
        logger.error({ err: error }, "error searching icons");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export const getIconHandler = (req, res) => {
    const icon = iconFor(req.params.set, req.params.name);
    if (!icon) return res.status(404).json({ message: "Icon not found." });
    return res.status(200).json({ icon });
};
