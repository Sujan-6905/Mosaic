// Ranks every object against a description by name overlap, embedding similarity, spatial
// constraint and recency or selection; resolutionPolicy decides if the top is confident.
import { tokenize, embedText, cosineSimilarity } from "../search/embedding.js";
import { parseSpatialConstraint } from "./spatialConstraintParser.js";

const WEIGHTS = { lexical: 0.4, embedding: 0.25, spatial: 0.25, prior: 0.1 };
const ANCHOR_CANDIDATE_LIMIT = 3;

const lexicalScore = (queryTokens, text) => {
    if (!text || queryTokens.length === 0) return 0;
    const textTokens = new Set(tokenize(text));
    if (textTokens.size === 0) return 0;
    const overlap = queryTokens.filter((token) => textTokens.has(token)).length;
    return overlap / queryTokens.length;
};

// connected-to reads both ways, so it's indexed both ways; a directional relation's reverse
// is a different relation.
const SYMMETRIC_RELATIONS = new Set(["connected-to", "aligned-with", "overlaps"]);

// "inside X" matches frame membership as well as bounding-box containment.
const RELATION_QUERY_ALIASES = { inside: ["inside", "inside-frame"] };

const buildRelationIndex = (relations) => {
    const bySubject = new Map();
    const add = (subject, relation, object) => {
        if (!bySubject.has(subject)) bySubject.set(subject, []);
        bySubject.get(subject).push({ relation, object });
    };
    for (const [subject, relation, object] of relations) {
        add(subject, relation, object);
        if (SYMMETRIC_RELATIONS.has(relation)) add(object, relation, subject);
    }
    return bySubject;
};

const DIRECTIONAL_RELATIONS = new Set(["above", "below", "left-of", "right-of"]);

// A caption is always its shape's nearest neighbour, so a directional query anchored on the
// caption must not match the shape it names.
const isLabelOfAnchor = (ref, anchorRefs, relationIndex) => {
    const held = relationIndex.get(ref) || [];
    return held.some((entry) => entry.relation === "nearest-label" && anchorRefs.includes(entry.object));
};

// A soft signal rather than a filter, so a loose parse can't zero out a strong match.
const spatialScore = (ref, relation, anchorRefs, relationIndex) => {
    if (!relation || anchorRefs.length === 0) return 0;
    if (DIRECTIONAL_RELATIONS.has(relation) && isLabelOfAnchor(ref, anchorRefs, relationIndex)) return 0;
    const acceptableRelations = RELATION_QUERY_ALIASES[relation] ?? [relation];
    const held = relationIndex.get(ref) || [];
    return held.some((entry) => acceptableRelations.includes(entry.relation) && anchorRefs.includes(entry.object)) ? 1 : 0;
};

const inViewport = (bounds, viewport) => {
    if (!viewport) return false;
    return bounds.minX <= viewport.maxX && bounds.maxX >= viewport.minX && bounds.minY <= viewport.maxY && bounds.maxY >= viewport.minY;
};

// The anchor only narrows candidates, so lexical score alone is enough.
const resolveAnchorRefs = (objects, anchorText) => {
    if (!anchorText) return [];
    const anchorTokens = tokenize(anchorText);
    return objects
        .map((object) => ({ ref: object.ref, score: lexicalScore(anchorTokens, object.name) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, ANCHOR_CANDIDATE_LIMIT)
        .map((entry) => entry.ref);
};

export const resolveReference = (groundedScene, description, { selection = [], viewport = null } = {}) => {
    const { subjectText, relation, anchorText } = parseSpatialConstraint(description);
    const queryText = subjectText || description;
    const queryTokens = tokenize(queryText);
    const queryEmbedding = embedText(queryText);
    const relationIndex = buildRelationIndex(groundedScene.relations);
    const selectionSet = new Set(selection);
    const anchorRefs = resolveAnchorRefs(groundedScene.objects, anchorText);

    const scored = groundedScene.objects.map((object) => {
        const lexical = lexicalScore(queryTokens, object.name);
        const embedding = object.name ? cosineSimilarity(queryEmbedding, embedText(object.name)) : 0;
        const spatial = spatialScore(object.ref, relation, anchorRefs, relationIndex);
        const prior = selectionSet.has(object.ref) ? 1 : inViewport(object.bounds, viewport) ? 0.5 : 0;
        const score = lexical * WEIGHTS.lexical + embedding * WEIGHTS.embedding + spatial * WEIGHTS.spatial + prior * WEIGHTS.prior;
        // elementId for the single-member case; elementIds for a merged object.
        const elementIds = object.memberElementIds ?? [object.elementId];
        return {
            ref: object.ref,
            elementId: elementIds.length === 1 ? elementIds[0] : null,
            elementIds,
            name: object.name,
            type: object.type,
            score,
        };
    });

    return scored.sort((a, b) => b.score - a.score);
};
