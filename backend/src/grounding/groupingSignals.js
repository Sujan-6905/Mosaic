// Groups canonical-scene objects into what a person would point at ("the box with the arrow").
// Deliberately conservative: structured elements that merely touch are never merged.
import { boundsCenter, boundsContains } from "../../../shared/canvas/geometry/bounds.js";
import { hashToBase36 } from "./contentHash.js";
import { LABEL_SEARCH_RADIUS_PX } from "./labelAttachment.js";

const ADJACENCY_GAP_PX = 6;
const LOOSE_PROXIMITY_PX = 150;
const FRAME_SIGNAL_BOOST = 0.15;

const distanceBetweenBounds = (a, b) => {
    const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
    const dy = Math.max(a.minY - b.maxY, b.minY - a.maxY, 0);
    return Math.hypot(dx, dy);
};

const boundsOverlapOrAdjacent = (a, b, gap) => distanceBetweenBounds(a, b) <= gap;

// A named stroke is one part of a sketch the assistant drew, already a thing in
// its own right, so it stays addressable instead of clustering with its neighbours.
const isLooseStroke = (object) => object.type === "path" && !object.name;

// Union-find, so the partition is the same whatever order pairs are visited in.
class UnionFind {
    constructor(keys) {
        this.parent = new Map(keys.map((key) => [key, key]));
    }

    find(key) {
        while (this.parent.get(key) !== key) {
            this.parent.set(key, this.parent.get(this.parent.get(key)));
            key = this.parent.get(key);
        }
        return key;
    }

    union(a, b) {
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA !== rootB) this.parent.set(rootA, rootB);
    }
}

// A label and its nearest unlabelled neighbour become one object, but only when each is
// the other's nearest, so one caption can't claim two shapes.
const findLabelShapePairs = (objects) => {
    const labels = objects.filter((object) => object.type === "text" || object.type === "sticky");
    const shapes = objects.filter((object) => object.type !== "text" && object.type !== "sticky" && object.type !== "frame");
    const pairs = [];

    for (const label of labels) {
        let nearestShape = null;
        let nearestDistance = Infinity;
        for (const shape of shapes) {
            const distance = Math.hypot(
                boundsCenter(label.bounds).x - boundsCenter(shape.bounds).x,
                boundsCenter(label.bounds).y - boundsCenter(shape.bounds).y,
            );
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestShape = shape;
            }
        }
        if (!nearestShape || nearestDistance > LABEL_SEARCH_RADIUS_PX) continue;

        let nearestLabelForShape = null;
        let nearestLabelDistance = Infinity;
        for (const candidateLabel of labels) {
            const distance = Math.hypot(
                boundsCenter(candidateLabel.bounds).x - boundsCenter(nearestShape.bounds).x,
                boundsCenter(candidateLabel.bounds).y - boundsCenter(nearestShape.bounds).y,
            );
            if (distance < nearestLabelDistance) {
                nearestLabelDistance = distance;
                nearestLabelForShape = candidateLabel;
            }
        }
        if (nearestLabelForShape?.ref === label.ref) pairs.push({ label, shape: nearestShape });
    }
    return pairs;
};

// Structural signals, strongest first, plus a per-pair trace of what fired. Freehand signals
// respect `elementAuthors`, since a merge across two authors could never be undone later.
export const groupByStructuralSignals = (objects, elementAuthors = new Map()) => {
    const byRef = new Map(objects.map((object) => [object.ref, object]));
    const unionFind = new UnionFind(objects.map((object) => object.ref));
    const trace = [];
    const differentKnownAuthors = (a, b) => {
        const authorA = elementAuthors.get(a.elementId);
        const authorB = elementAuthors.get(b.elementId);
        return authorA !== undefined && authorB !== undefined && authorA !== authorB;
    };

    const merge = (refA, refB, signal, weight) => {
        if (refA === refB) return;
        unionFind.union(refA, refB);
        trace.push({ pair: [refA, refB].sort(), signal, weight });
    };

    const sameFrame = (a, b) => a.frameId !== null && a.frameId === b.frameId;
    const boosted = (base, a, b) => (sameFrame(a, b) ? base + FRAME_SIGNAL_BOOST : base);

    // 1. Explicit groupId: ground truth, never overridden by anything else
    // in this pass (nothing later can split a union-find merge).
    const byGroupId = new Map();
    for (const object of objects) {
        if (!object.groupId) continue;
        if (!byGroupId.has(object.groupId)) byGroupId.set(object.groupId, []);
        byGroupId.get(object.groupId).push(object.ref);
    }
    for (const refs of byGroupId.values()) {
        for (let i = 1; i < refs.length; i++) merge(refs[0], refs[i], "explicit-group", 1);
    }

    // 2. A shape and its attached label: two-objects-for-one-thing is
    // exactly the confusion this signal exists to remove.
    for (const { label, shape } of findLabelShapePairs(objects)) {
        merge(label.ref, shape.ref, "label-attachment", 0.9);
    }

    const paths = objects.filter(isLooseStroke);
    const nonPathNonFrame = objects.filter((object) => object.type !== "path" && object.type !== "frame");

    // A freehand stroke drawn inside a shape, sticky or image annotates it.
    for (const path of paths) {
        for (const container of nonPathNonFrame) {
            if (container.ref === path.ref) continue;
            if (boundsContains(container.bounds, path.bounds)) {
                merge(path.ref, container.ref, "containment", boosted(0.7, path, container));
            }
        }
    }

    // Overlap, adjacency and draw-order signals apply only between freehand strokes.
    const sortedPaths = [...paths].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    for (let i = 0; i < sortedPaths.length; i++) {
        for (let j = i + 1; j < sortedPaths.length; j++) {
            const a = sortedPaths[i];
            const b = sortedPaths[j];
            if (differentKnownAuthors(a, b)) continue;
            if (boundsOverlapOrAdjacent(a.bounds, b.bounds, ADJACENCY_GAP_PX)) {
                merge(a.ref, b.ref, "adjacency", boosted(0.5, a, b));
                continue;
            }
            // The weakest signal: only strictly consecutive strokes that are still close together.
            const isConsecutive = sortedPaths[j - 1] === a;
            if (isConsecutive && boundsOverlapOrAdjacent(a.bounds, b.bounds, LOOSE_PROXIMITY_PX)) {
                merge(a.ref, b.ref, "z-order-contiguity", boosted(0.3, a, b));
            }
        }
    }

    // An unbound connector end on a freehand stroke joins that sketch; a bound end is a
    // relation between two objects, not a merge.
    const connectors = objects.filter((object) => object.type === "connector");
    for (const connector of connectors) {
        const freeEnds = [];
        if (!connector.startElementId) freeEnds.push(boundsCenter(connector.bounds));
        for (const path of paths) {
            for (const point of freeEnds) {
                const distance = Math.hypot(point.x - boundsCenter(path.bounds).x, point.y - boundsCenter(path.bounds).y);
                if (boundsContains(path.bounds, { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }) || distance <= ADJACENCY_GAP_PX) {
                    merge(connector.ref, path.ref, "connector-binding", boosted(0.6, connector, path));
                }
            }
        }
    }

    const groups = new Map();
    for (const object of objects) {
        const root = unionFind.find(object.ref);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(object.ref);
    }

    return {
        partitions: [...groups.values()].map((memberRefs) => memberRefs.sort()),
        trace,
        byRef,
    };
};

const DEFAULT_MIN_GAP_MS = 800;
const MAX_GAP_MS = 4000;
const BURST_PROXIMITY_PX = 200;

// Bursts from the op log (`[{ elementId, authorId, ts }]`, already windowed by the caller):
// strokes by the same author that are close in both time and space.
export const groupByTemporalSignal = (objects, opLogEntries) => {
    const byElementId = new Map(objects.map((object) => [object.elementId, object]));
    const byRef = new Map(objects.map((object) => [object.ref, object]));

    // Grouping cares when a stroke was drawn, not when it was last touched.
    const firstSeen = new Map();
    for (const entry of opLogEntries) {
        if (!byElementId.has(entry.elementId)) continue;
        const existing = firstSeen.get(entry.elementId);
        if (!existing || entry.ts < existing.ts) firstSeen.set(entry.elementId, entry);
    }

    const timed = [...firstSeen.entries()]
        .map(([elementId, entry]) => ({ object: byElementId.get(elementId), authorId: entry.authorId, ts: entry.ts }))
        .filter((entry) => isLooseStroke(entry.object))
        .sort((a, b) => a.ts - b.ts);

    const unionFind = new UnionFind(objects.map((object) => object.ref));
    const trace = [];

    // The author's median stroke interval, clamped, so a fast sketcher isn't split and one
    // long pause doesn't loosen every later pair.
    let previous = null;
    let runGaps = [];
    for (const current of timed) {
        if (previous && previous.authorId === current.authorId) {
            const gap = current.ts - previous.ts;
            const adaptiveGap = runGaps.length ? Math.min(MAX_GAP_MS, Math.max(DEFAULT_MIN_GAP_MS, median(runGaps) * 2)) : DEFAULT_MIN_GAP_MS;
            const spatiallyClose = boundsOverlapOrAdjacent(previous.object.bounds, current.object.bounds, BURST_PROXIMITY_PX);
            if (gap <= adaptiveGap && spatiallyClose) {
                unionFind.union(previous.object.ref, current.object.ref);
                trace.push({ pair: [previous.object.ref, current.object.ref].sort(), signal: "temporal-burst", weight: 0.6 });
                runGaps.push(gap);
            } else {
                runGaps = [];
            }
        } else {
            runGaps = [];
        }
        previous = current;
    }

    const groups = new Map();
    for (const object of objects) {
        const root = unionFind.find(object.ref);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(object.ref);
    }

    return {
        partitions: [...groups.values()].map((memberRefs) => memberRefs.sort()),
        trace,
        byRef,
        // Lets the caller report a structural-only grouping instead of implying the temporal pass ran.
        degraded: timed.length === 0,
    };
};

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// The final partition: explicit user groups, then structural, then temporal signals.
// Confidence is the share of independent passes that agree on a merge.
export const arbitrateGrouping = (structural, temporal, objects) => {
    const refs = objects.map((object) => object.ref);
    const unionFind = new UnionFind(refs);

    const applyPartition = (partitions) => {
        for (const members of partitions) {
            for (let i = 1; i < members.length; i++) unionFind.union(members[0], members[i]);
        }
    };
    // Unions are monotonic, so the temporal pass can only add merges, never override one.
    applyPartition(structural.partitions);
    applyPartition(temporal.partitions);

    const groups = new Map();
    for (const object of objects) {
        const root = unionFind.find(object.ref);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(object.ref);
    }

    const structuralTraceByRef = new Map();
    const temporalRefsInGroup = new Set();
    for (const entry of temporal.trace) entry.pair.forEach((ref) => temporalRefsInGroup.add(ref));
    for (const entry of structural.trace) {
        entry.pair.forEach((ref) => {
            if (!structuralTraceByRef.has(ref)) structuralTraceByRef.set(ref, []);
            structuralTraceByRef.get(ref).push(entry);
        });
    }

    const partitions = [...groups.values()].map((memberRefs) => memberRefs.sort());
    const explanations = partitions.map((memberRefs) => {
        const signals = new Set();
        let structuralAgrees = false;
        let temporalAgrees = false;
        memberRefs.forEach((ref) => {
            (structuralTraceByRef.get(ref) || []).forEach((entry) => {
                signals.add(entry.signal);
                structuralAgrees = true;
            });
            if (temporalRefsInGroup.has(ref)) temporalAgrees = true;
        });

        const passesAgreeing = (memberRefs.length === 1 ? 1 : 0) + (structuralAgrees ? 1 : 0) + (temporalAgrees ? 1 : 0);
        const confidence = memberRefs.length === 1 ? 1 : Math.min(1, passesAgreeing / 2);

        return {
            memberRefs,
            signals: [...signals, ...(temporalAgrees ? ["temporal-burst"] : [])],
            confidence,
            degradedTemporal: temporal.degraded,
        };
    });

    return { groups: explanations };
};

const GROUP_REF_PREFIX = "grp_";

// The same member set always mints the same ref; collisions are salted and rehashed.
export const mintGroupRef = (memberRefs, usedRefs = new Set()) => {
    const basis = [...memberRefs].sort().join(",");
    let salt = 0;
    let ref = `${GROUP_REF_PREFIX}${hashToBase36(basis)}`;
    while (usedRefs.has(ref)) {
        salt += 1;
        ref = `${GROUP_REF_PREFIX}${hashToBase36(`${basis}:${salt}`)}`;
    }
    return ref;
};

// Carries refs across a recomputed partition by member overlap, so "obj_7" keeps meaning the
// same drawing. A split group retires its ref; a merge inherits the largest contributor's.
export const stabilizeGroupRefs = (newGroups, previousGroups, usedRefs = new Set()) => {
    const previousByMember = new Map();
    previousGroups.forEach((previous) => {
        previous.memberRefs.forEach((memberRef) => previousByMember.set(memberRef, previous.ref));
    });

    // How many distinct new groups does each previous group's membership
    // now touch - >1 means it split.
    const newGroupsTouchedByPrevious = new Map();
    newGroups.forEach((group, index) => {
        const touched = new Set();
        group.memberRefs.forEach((memberRef) => {
            const previousRef = previousByMember.get(memberRef);
            if (previousRef) touched.add(previousRef);
        });
        touched.forEach((previousRef) => {
            if (!newGroupsTouchedByPrevious.has(previousRef)) newGroupsTouchedByPrevious.set(previousRef, new Set());
            newGroupsTouchedByPrevious.get(previousRef).add(index);
        });
    });

    const splitPreviousRefs = new Set([...newGroupsTouchedByPrevious.entries()].filter(([, touched]) => touched.size > 1).map(([previousRef]) => previousRef));

    const retiredRefs = new Set(previousGroups.map((previous) => previous.ref));
    // Whatever remains in retiredRefs afterwards is reported as changed.
    const stableGroups = newGroups.map((group) => {
        const contributionCounts = new Map();
        group.memberRefs.forEach((memberRef) => {
            const previousRef = previousByMember.get(memberRef);
            if (!previousRef || splitPreviousRefs.has(previousRef)) return;
            contributionCounts.set(previousRef, (contributionCounts.get(previousRef) ?? 0) + 1);
        });

        let bestPreviousRef = null;
        let bestCount = 0;
        for (const [previousRef, count] of contributionCounts) {
            if (count > bestCount) {
                bestCount = count;
                bestPreviousRef = previousRef;
            }
        }

        const ref = bestPreviousRef ?? mintGroupRef(group.memberRefs, usedRefs);
        usedRefs.add(ref);
        if (bestPreviousRef) retiredRefs.delete(bestPreviousRef);
        return { ...group, ref };
    });

    splitPreviousRefs.forEach((ref) => retiredRefs.add(ref));

    return { groups: stableGroups, retiredRefs: [...retiredRefs] };
};
