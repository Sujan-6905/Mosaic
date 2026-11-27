// Resolved only when the top score clears the threshold and leads the runner-up by a margin;
// otherwise a shortlist to ask about, or none.
const RESOLVED_THRESHOLD = 0.55;
const AMBIGUOUS_THRESHOLD = 0.2;
const AMBIGUOUS_GAP = 0.1;
const MAX_CANDIDATES = 5;

export const applyResolutionPolicy = (rankedCandidates) => {
    const candidates = rankedCandidates.filter((candidate) => candidate.score >= AMBIGUOUS_THRESHOLD).slice(0, MAX_CANDIDATES);
    if (candidates.length === 0) return { status: "none", candidates: [] };

    const [best, second] = candidates;
    const isConfident = best.score >= RESOLVED_THRESHOLD && (!second || best.score - second.score >= AMBIGUOUS_GAP);
    if (isConfident) return { status: "resolved", candidates: [best] };

    return { status: "ambiguous", candidates };
};
