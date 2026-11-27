import Drawing from "../models/drawingSchema.js";
import SearchIndex from "../models/searchIndexSchema.js";
import { buildSearchIndex } from "./indexer.js";
import logger from "../observability/logger.js";

const findDrawingByShareId = async (shareId) => {
    try {
        return await Drawing.findOne({ shareId });
    } catch (error) {
        return null;
    }
};

// Runs on each autosave flush and once at creation, so a new board is searchable by title.
const indexBoardForSearch = async (shareId, elements) => {
    const drawing = await findDrawingByShareId(shareId);
    const title = drawing?.title || "";
    const chunks = buildSearchIndex(title, elements);

    const existing = await SearchIndex.findOne({ shareId }).catch(() => null);
    if (existing) {
        existing.title = title;
        existing.chunks = chunks;
        await existing.save();
    } else {
        await SearchIndex.create({ shareId, title, chunks });
    }
};

const indexBoardForSearchSafely = async (shareId, elements) => {
    try {
        await indexBoardForSearch(shareId, elements);
    } catch (error) {
        logger.error({ err: error, shareId }, "search index update failed for board");
    }
};

export { indexBoardForSearch, indexBoardForSearchSafely };
