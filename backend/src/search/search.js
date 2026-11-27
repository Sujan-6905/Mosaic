import { embedText, cosineSimilarity } from "./embedding.js";

// A verbatim match outranks a merely similar chunk without beating a strong vector match elsewhere.
const KEYWORD_BOOST = 0.5;

const scoreChunk = (queryEmbedding, query, chunk) => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    const isExactMatch = chunk.text.toLowerCase().includes(query.toLowerCase());
    return similarity + (isExactMatch ? KEYWORD_BOOST : 0);
};

// `indexes` are already limited to boards the user can open. Each result carries its best
// chunk so a click can jump to it.
const searchBoards = (indexes, query, limit = 20) => {
    const queryEmbedding = embedText(query);
    const results = [];

    indexes.forEach((index) => {
        let best = null;
        (index.chunks || []).forEach((chunk) => {
            const score = scoreChunk(queryEmbedding, query, chunk);
            if (!best || score > best.score) best = { ...chunk, score };
        });
        if (best && best.score > 0) {
            results.push({ shareId: index.shareId, title: index.title, score: best.score, match: best });
        }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
};

export { searchBoards };
