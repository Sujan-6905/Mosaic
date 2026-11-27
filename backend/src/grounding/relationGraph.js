// Spatial and structural relations, so a model reads "obj_7 below obj_4" instead of
// reasoning from coordinates.
import { boundsCenter, boundsIntersect, boundsContains } from "../../../shared/canvas/geometry/bounds.js";

// Loose enough for freehand wobble, tight enough that half the board isn't "aligned".
const ALIGNMENT_TOLERANCE_PX = 12;

const distanceBetween = (a, b) => {
    const centerA = boundsCenter(a);
    const centerB = boundsCenter(b);
    return Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y);
};

// The larger displacement decides, so one object is never both below and right of another.
const directionOf = (from, to) => {
    const a = boundsCenter(from);
    const b = boundsCenter(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right-of" : "left-of";
    return dy > 0 ? "below" : "above";
};

// A connector's centre lands wherever its ends put it, so it contributes only its binding.
const isPositionable = (object) => object.type !== "connector";

export const buildRelationGraph = (objects) => {
    const relations = [];
    const byRef = new Map(objects.map((object) => [object.ref, object]));
    const positionable = objects.filter(isPositionable);

    // Every pair: O(n^2) is fine at board sizes, and the cache skips unchanged boards.
    for (let i = 0; i < positionable.length; i++) {
        for (let j = i + 1; j < positionable.length; j++) {
            const a = positionable[i];
            const b = positionable[j];

            // Frame children are reported as inside-frame below.
            if (a.type !== "frame" && b.type !== "frame") {
                if (boundsContains(a.bounds, b.bounds)) {
                    relations.push([b.ref, "inside", a.ref]);
                } else if (boundsContains(b.bounds, a.bounds)) {
                    relations.push([a.ref, "inside", b.ref]);
                } else if (boundsIntersect(a.bounds, b.bounds)) {
                    relations.push([a.ref, "overlaps", b.ref]);
                }
            }

            const centerA = boundsCenter(a.bounds);
            const centerB = boundsCenter(b.bounds);
            if (Math.abs(centerA.x - centerB.x) <= ALIGNMENT_TOLERANCE_PX || Math.abs(centerA.y - centerB.y) <= ALIGNMENT_TOLERANCE_PX) {
                relations.push([a.ref, "aligned-with", b.ref]);
            }
        }
    }

    // One nearest neighbour per direction, as [winner, direction, object]: "winner is below object".
    for (const object of positionable) {
        const nearestByDirection = { above: null, below: null, "left-of": null, "right-of": null };
        for (const other of positionable) {
            if (other.ref === object.ref) continue;
            const direction = directionOf(object.bounds, other.bounds);
            const distance = distanceBetween(object.bounds, other.bounds);
            const current = nearestByDirection[direction];
            if (!current || distance < current.distance) {
                nearestByDirection[direction] = { ref: other.ref, distance };
            }
        }
        for (const [direction, winner] of Object.entries(nearestByDirection)) {
            if (winner) relations.push([winner.ref, direction, object.ref]);
        }
    }

    // Repeated from frameId so consumers read every relation from the graph.
    for (const object of objects) {
        if (object.frameId && byRef.has(object.frameId)) {
            relations.push([object.ref, "inside-frame", object.frameId]);
        }
    }

    // A drawn arrow is the strongest signal of an intended relationship.
    for (const object of objects) {
        if (object.type !== "connector") continue;
        if (object.startElementId && object.endElementId) {
            relations.push([object.startElementId, "connected-to", object.endElementId]);
        }
    }

    return relations;
};
