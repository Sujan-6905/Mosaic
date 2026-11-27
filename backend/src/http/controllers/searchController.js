import { getDefaultInstance } from "ottoman";
import { listAccessibleDrawings } from "./drawingController.js";
import { searchBoards } from "../../search/search.js";
import logger from "../../observability/logger.js";

const bucketName = () => process.env.CB_BUCKET_NAME;

// The dashboard's own boundary, so search never reveals a board the caller can't open.
const getAccessibleShareIds = async (principal) => {
    const { owned, shared } = await listAccessibleDrawings(principal);
    return [...owned, ...shared].map((drawing) => drawing.shareId);
};

const fetchIndexesForShareIds = async (shareIds) => {
    if (shareIds.length === 0) return [];
    const ottoman = getDefaultInstance();
    const result = await ottoman.query(
        `SELECT searchIndexes.* FROM \`${bucketName()}\`.\`app\`.\`searchIndexes\` AS searchIndexes
         WHERE shareId IN $shareIds`,
        { parameters: { shareIds } },
    );
    return result.rows;
};

const searchBoardsHandler = async (req, res) => {
    try {
        const query = (req.query.q || "").trim();
        if (!query) {
            return res.status(400).json({ message: "q is required" });
        }

        const shareIds = await getAccessibleShareIds(req.user);
        const indexes = await fetchIndexesForShareIds(shareIds);
        const results = searchBoards(indexes, query);

        return res.status(200).json({ results });
    } catch (error) {
        logger.error({ err: error }, "error searching boards");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export { getAccessibleShareIds, searchBoardsHandler };
