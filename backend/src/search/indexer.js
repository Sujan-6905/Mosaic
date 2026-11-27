import { embedText } from "./embedding.js";
import { wordsOf } from "../../../shared/canvas/elements/elementWords.js";

const MAX_CHUNK_TEXT_LENGTH = 300;

const extractChunks = (title, elements) => {
    const chunks = [];
    if (title && title.trim()) {
        chunks.push({ sourceType: "title", elementId: null, text: title, x: null, y: null });
    }

    Object.entries(elements || {}).forEach(([elementId, element]) => {
        const text = wordsOf(element);
        if (!text) return;
        chunks.push({
            sourceType: element.type === "path" ? "sketch" : element.type,
            elementId,
            text,
            x: element.x ?? element.startX ?? null,
            y: element.y ?? element.startY ?? null,
        });
    });

    return chunks.map((chunk) => ({ ...chunk, text: chunk.text.slice(0, MAX_CHUNK_TEXT_LENGTH) }));
};

const buildSearchIndex = (title, elements) => extractChunks(title, elements).map((chunk) => ({ ...chunk, embedding: embedText(chunk.text) }));

export { extractChunks, buildSearchIndex };
