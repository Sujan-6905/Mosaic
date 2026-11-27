import { buildBoard, buildOps, buildSnapshot, ownerOf } from "./fixtures.js";

export const DATASET = { boards: 20, elementsPerBoard: 300, owners: 5, opsPerBoard: 400, snapshotEvery: 50 };
const OP_BURST = 25;
const CONCURRENT_WRITERS = 20;

const pick = (i, count) => ((i % count) + count) % count;
const elementIdsOf = (board) => Object.keys(board.elements);

export const seedDataset = async (store) => {
    const boards = Array.from({ length: DATASET.boards }, (_, index) => buildBoard(index, DATASET));
    for (const board of boards) {
        await store.putBoard(board);
        await store.appendOps(buildOps(board.shareId, 1, DATASET.opsPerBoard, elementIdsOf(board)));
        for (let seq = DATASET.snapshotEvery; seq <= DATASET.opsPerBoard; seq += DATASET.snapshotEvery) await store.putSnapshot(buildSnapshot(board, seq));
    }
    await store.settle();
    return boards;
};

// Each is one thing the app does on a real path, timed per call. `check` proves the store kept every write.
export const WORKLOADS = [
    {
        id: "boardByKey",
        label: "Open a board by its key",
        run: (store, boards) => (i) => store.getBoardByKey(boards[pick(i, boards.length)].shareId),
    },
    {
        id: "boardByShareId",
        label: "Open a board by its share id (secondary index)",
        run: (store, boards) => (i) => store.getBoardByShareId(boards[pick(i, boards.length)].shareId),
    },
    {
        id: "autosaveElement",
        label: "Autosave one changed element (field-level write)",
        run: (store, boards) => (i) => {
            const board = boards[pick(i, boards.length)];
            const elementId = elementIdsOf(board)[pick(i, DATASET.elementsPerBoard)];
            return store.setElements(board.shareId, { [elementId]: { ...board.elements[elementId], text: `autosave ${i}` } });
        },
    },
    {
        id: "concurrentWriters",
        label: `${CONCURRENT_WRITERS} people editing different elements of one board at once`,
        // Its own writes are the concurrency, and one round at a time keeps the check's board untouched by others.
        concurrency: 1,
        run: (store, boards) => async (i) => {
            const board = boards[pick(i, boards.length)];
            const ids = elementIdsOf(board).slice(0, CONCURRENT_WRITERS);
            await Promise.all(
                ids.map((elementId) => store.setElements(board.shareId, { [elementId]: { ...board.elements[elementId], text: `${elementId} ${i}` } })),
            );
        },
        check: async (store, boards, lastIteration) => {
            const board = boards[pick(lastIteration, boards.length)];
            const stored = await store.getBoardByKey(board.shareId);
            const ids = elementIdsOf(board).slice(0, CONCURRENT_WRITERS);
            return ids.every((elementId) => stored.elements[elementId]?.text === `${elementId} ${lastIteration}`);
        },
    },
    {
        id: "opBurst",
        label: `Append a burst of ${OP_BURST} operations to the log`,
        run: (store, boards) => {
            let nextSeq = DATASET.opsPerBoard + 1;
            return (i) => {
                const board = boards[pick(i, boards.length)];
                const seq = nextSeq;
                nextSeq += OP_BURST;
                // Into a log of its own beside the board, so the replay below always reads the same 100 operations.
                return store.appendOps(buildOps(`${board.shareId}-burst`, seq, OP_BURST, elementIdsOf(board)));
            };
        },
    },
    {
        id: "opsSince",
        label: "Read the operations after a version (replay, catch-up)",
        run: (store, boards) => (i) => store.readOpsAfter(boards[pick(i, boards.length)].shareId, DATASET.opsPerBoard - 100),
    },
    {
        id: "snapshotAtOrBefore",
        label: "Find the latest version at or before a point (history scrubber)",
        run: (store, boards) => (i) => store.latestSnapshotAtOrBefore(boards[pick(i, boards.length)].shareId, 10 + pick(i * 37, DATASET.opsPerBoard)),
    },
    {
        id: "boardsByOwner",
        label: "List a person's boards, newest first (dashboard)",
        run: (store) => (i) => store.listBoardsByOwner(ownerOf(pick(i, DATASET.owners), DATASET.owners)),
    },
];
