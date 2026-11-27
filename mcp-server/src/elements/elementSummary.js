// A stored element plus a normalised `bounds` box, since start/end fields aren't ordered
// and a path has no box until its points are walked.
import { getElementBounds } from "../../../shared/canvas/geometry/bounds.js";
import { buildCanonicalScene, elementIdToRef } from "../../../backend/src/grounding/canonicalScene.js";

// Refs come from the grounding layer's canonical scene, so they match describe_board and resolve.
export const buildElementRefs = (elementsMap) => buildCanonicalScene(Object.fromEntries(elementsMap));

export const summarizeElement = (elementId, element, canonicalScene = null) => ({
    id: elementId,
    ref: canonicalScene ? elementIdToRef(canonicalScene, elementId) : null,
    bounds: getElementBounds(element),
    ...element,
});
