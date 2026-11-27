// Pairwise precision, recall and F1 for three grouping configurations, with over- and under-merges
// counted apart since an over-merged object can't be addressed at all.
import { buildCanonicalScene } from "../canonicalScene.js";
import { groupByStructuralSignals, groupByTemporalSignal, arbitrateGrouping } from "../groupingSignals.js";
import { GROUPING_FIXTURE_BOARDS } from "./groupingFixtures.js";

const PROXIMITY_THRESHOLD_PX = 60;

const boundsDistance = (a, b) => {
    const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
    const dy = Math.max(a.minY - b.maxY, b.minY - a.maxY, 0);
    return Math.hypot(dx, dy);
};

// The baseline: clusters by distance alone, ignoring authorship, time and structure.
const proximityOnlyPartition = (objects) => {
    const parent = new Map(objects.map((object) => [object.ref, object.ref]));
    const find = (ref) => {
        while (parent.get(ref) !== ref) {
            parent.set(ref, parent.get(parent.get(ref)));
            ref = parent.get(ref);
        }
        return ref;
    };
    const union = (a, b) => parent.set(find(a), find(b));

    for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
            if (boundsDistance(objects[i].bounds, objects[j].bounds) <= PROXIMITY_THRESHOLD_PX) {
                union(objects[i].ref, objects[j].ref);
            }
        }
    }

    const groups = new Map();
    for (const object of objects) {
        const root = find(object.ref);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(object.elementId);
    }
    return [...groups.values()];
};

const firstSeenAuthorByElement = (opLog) => {
    const authors = new Map();
    for (const entry of opLog) {
        if (!authors.has(entry.elementId)) authors.set(entry.elementId, entry.authorId);
    }
    return authors;
};

// Standard pairwise clustering metrics over "same object" pairs; over- and under-merged pairs
// are precision's and recall's error terms.
const scorePartition = (predicted, groundTruth) => {
    const truthGroupOf = new Map();
    groundTruth.forEach((group, index) => group.forEach((elementId) => truthGroupOf.set(elementId, index)));
    const predictedGroupOf = new Map();
    predicted.forEach((group, index) => group.forEach((elementId) => predictedGroupOf.set(elementId, index)));

    const elementIds = [...truthGroupOf.keys()];
    let truePositive = 0;
    let overMergedPairs = 0;
    let underMergedPairs = 0;
    let trueNegative = 0;

    for (let i = 0; i < elementIds.length; i++) {
        for (let j = i + 1; j < elementIds.length; j++) {
            const sameInTruth = truthGroupOf.get(elementIds[i]) === truthGroupOf.get(elementIds[j]);
            const sameInPredicted = predictedGroupOf.get(elementIds[i]) === predictedGroupOf.get(elementIds[j]);
            if (sameInTruth && sameInPredicted) truePositive += 1;
            else if (!sameInTruth && sameInPredicted) overMergedPairs += 1;
            else if (sameInTruth && !sameInPredicted) underMergedPairs += 1;
            else trueNegative += 1;
        }
    }

    return { truePositive, overMergedPairs, underMergedPairs, trueNegative };
};

const withRates = (totals) => {
    const precision = totals.truePositive + totals.overMergedPairs === 0 ? 1 : totals.truePositive / (totals.truePositive + totals.overMergedPairs);
    const recall = totals.truePositive + totals.underMergedPairs === 0 ? 1 : totals.truePositive / (totals.truePositive + totals.underMergedPairs);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { ...totals, precision, recall, f1 };
};

const refPartitionToElementIds = (partitions, byRef) => partitions.map((memberRefs) => memberRefs.map((ref) => byRef.get(ref).elementId));

const CONFIGS = {
    "proximity-only": (objects) => proximityOnlyPartition(objects),
    "structural-only": (objects, opLog) => {
        const structural = groupByStructuralSignals(objects, firstSeenAuthorByElement(opLog));
        return refPartitionToElementIds(structural.partitions, structural.byRef);
    },
    "structural-plus-temporal": (objects, opLog) => {
        const authors = firstSeenAuthorByElement(opLog);
        const structural = groupByStructuralSignals(objects, authors);
        const temporal = groupByTemporalSignal(objects, opLog);
        const arbitrated = arbitrateGrouping(structural, temporal, objects);
        const byRef = new Map(objects.map((object) => [object.ref, object]));
        return arbitrated.groups.map((group) => group.memberRefs.map((ref) => byRef.get(ref).elementId));
    },
};

// All three configurations over every fixture board, per board and overall.
export const runGroupingBenchmark = (boards = GROUPING_FIXTURE_BOARDS) => {
    const results = {};

    for (const [configName, computePartition] of Object.entries(CONFIGS)) {
        const boardResults = boards.map((board) => {
            const canonicalScene = buildCanonicalScene(board.elements);
            const predicted = computePartition(canonicalScene.objects, board.opLog);
            const scores = scorePartition(predicted, board.groundTruth);
            return { board: board.name, predicted, ...withRates(scores) };
        });

        const totals = boardResults.reduce(
            (acc, board) => ({
                truePositive: acc.truePositive + board.truePositive,
                overMergedPairs: acc.overMergedPairs + board.overMergedPairs,
                underMergedPairs: acc.underMergedPairs + board.underMergedPairs,
                trueNegative: acc.trueNegative + board.trueNegative,
            }),
            { truePositive: 0, overMergedPairs: 0, underMergedPairs: 0, trueNegative: 0 },
        );

        results[configName] = { boards: boardResults, overall: withRates(totals) };
    }

    return results;
};
