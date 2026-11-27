// Names an unlabelled object after the nearest text or sticky close enough to be its caption,
// the usual way a diagram box gets its name.
import { boundsCenter } from "../../../shared/canvas/geometry/bounds.js";

export const LABEL_SEARCH_RADIUS_PX = 80;
const LABEL_TEXT_MAX_LENGTH = 60;

const truncate = (text) => (text.length > LABEL_TEXT_MAX_LENGTH ? `${text.slice(0, LABEL_TEXT_MAX_LENGTH - 1)}…` : text);

// Mutates unlabeled objects in place (name is null until this runs) and
// returns the nearest-label relations to fold into the relation graph.
export const attachNearestLabels = (objects) => {
    const labelCandidates = objects.filter((object) => (object.type === "text" || object.type === "sticky") && object.name);
    const relations = [];

    for (const object of objects) {
        if (object.name || object.type === "text" || object.type === "sticky") continue;

        const center = boundsCenter(object.bounds);
        let nearest = null;
        let nearestDistance = Infinity;
        for (const candidate of labelCandidates) {
            const candidateCenter = boundsCenter(candidate.bounds);
            const distance = Math.hypot(center.x - candidateCenter.x, center.y - candidateCenter.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = candidate;
            }
        }

        if (nearest && nearestDistance <= LABEL_SEARCH_RADIUS_PX) {
            object.name = truncate(nearest.name);
            relations.push([object.ref, "nearest-label", nearest.ref]);
        }
    }

    return relations;
};
