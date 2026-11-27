// Resolution accuracy of the reference resolver against fixtures.js.
import { buildGroundedScene } from "../buildGroundedScene.js";
import { resolveReference } from "../referenceResolver.js";
import { FIXTURE_BOARDS } from "./fixtures.js";

// A merged candidate carries the id in elementIds, so membership covers solo and grouped objects.
const rankOfExpected = (ranked, expectedElementId) => ranked.findIndex((candidate) => candidate.elementIds.includes(expectedElementId));

export const runResolverBenchmark = async (boards = FIXTURE_BOARDS) => {
    const boardResults = [];
    for (const board of boards) {
        const groundedScene = await buildGroundedScene(`eval-${board.name}`, board.elements);
        const cases = board.cases.map((testCase) => {
            const ranked = resolveReference(groundedScene, testCase.query);
            const rank = rankOfExpected(ranked, testCase.expectedElementId);
            return {
                query: testCase.query,
                expectedElementId: testCase.expectedElementId,
                topCandidate: ranked[0] ?? null,
                correctAt1: rank === 0,
                correctAt3: rank >= 0 && rank < 3,
            };
        });

        const total = cases.length;
        const correctAt1 = cases.filter((c) => c.correctAt1).length;
        const correctAt3 = cases.filter((c) => c.correctAt3).length;

        boardResults.push({
            board: board.name,
            total,
            correctAt1,
            correctAt3,
            accuracyAt1: total === 0 ? 0 : correctAt1 / total,
            accuracyAt3: total === 0 ? 0 : correctAt3 / total,
            cases,
        });
    }

    const total = boardResults.reduce((sum, b) => sum + b.total, 0);
    const correctAt1 = boardResults.reduce((sum, b) => sum + b.correctAt1, 0);
    const correctAt3 = boardResults.reduce((sum, b) => sum + b.correctAt3, 0);

    return {
        boards: boardResults,
        overall: {
            total,
            correctAt1,
            correctAt3,
            accuracyAt1: total === 0 ? 0 : correctAt1 / total,
            accuracyAt3: total === 0 ? 0 : correctAt3 / total,
        },
    };
};
