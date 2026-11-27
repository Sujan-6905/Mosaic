// A feature-hashed bag of words, L2-normalised so a dot product is cosine similarity.
// Token overlap only, no meaning, so search needs no paid embeddings API.
const VECTOR_DIM = 128;

const tokenize = (text) => (text || "").toLowerCase().match(/[a-z0-9]+/g) || [];

const hashToken = (token) => {
    let hash = 2166136261; // FNV-1a offset basis
    for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % VECTOR_DIM;
};

const embedText = (text) => {
    const vector = new Array(VECTOR_DIM).fill(0);
    tokenize(text).forEach((token) => {
        vector[hashToken(token)] += 1;
    });
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
};

// Both vectors are already unit-normalized, so a plain dot product is the
// cosine similarity: no need to divide by magnitudes again here.
const cosineSimilarity = (a, b) => {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
};

export { VECTOR_DIM, tokenize, embedText, cosineSimilarity };
