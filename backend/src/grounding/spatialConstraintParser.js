// Maps a fixed set of direction phrases onto relationGraph's relation names, so a constraint
// filters the graph directly.
const DIRECTION_PHRASES = [
    { pattern: /\b(under|below|beneath)\b/i, relation: "below" },
    { pattern: /\b(above|over)\b/i, relation: "above" },
    { pattern: /\b(to the left of|left of)\b/i, relation: "left-of" },
    { pattern: /\b(to the right of|right of)\b/i, relation: "right-of" },
    { pattern: /\b(inside|within)\b/i, relation: "inside" },
    { pattern: /\b(connected to|linked to|pointing to)\b/i, relation: "connected-to" },
    { pattern: /\b(next to|near|close to)\b/i, relation: "aligned-with" },
];

// Splits at the first direction phrase: { subjectText, relation, anchorText }, with null
// relation and anchor when there is none.
export const parseSpatialConstraint = (description) => {
    for (const { pattern, relation } of DIRECTION_PHRASES) {
        const match = description.match(pattern);
        if (!match) continue;
        const anchorText = description.slice(match.index + match[0].length).trim();
        if (!anchorText) continue;
        const subjectText = description.slice(0, match.index).trim();
        return { subjectText: subjectText || null, relation, anchorText };
    }
    return { subjectText: description.trim(), relation: null, anchorText: null };
};
