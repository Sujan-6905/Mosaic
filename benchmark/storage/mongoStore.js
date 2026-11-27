import { requireFromBackend } from "../packageResolution.js";

const { MongoClient } = requireFromBackend("mongodb");

const DEFAULT_DATABASE = "mosaic_bench";

// The same operations as v1's MongoDB build would issue: _id lookups, $set on element paths, indexed finds.
export const openMongo = async (env = process.env) => {
    const client = await new MongoClient(env.MONGODB_URI).connect();
    const db = client.db(env.MONGODB_DB || DEFAULT_DATABASE);
    const boards = db.collection("boards");
    const ops = db.collection("ops");
    const snapshots = db.collection("snapshots");
    // A run stopped part way leaves its documents behind, and seeding inserts.
    await Promise.all([boards, ops, snapshots].map((collection) => collection.deleteMany({})));
    await Promise.all([
        boards.createIndex({ shareId: 1 }),
        boards.createIndex({ owner: 1, createdAt: -1 }),
        ops.createIndex({ shareId: 1, seq: 1 }, { unique: true }),
        snapshots.createIndex({ shareId: 1, seq: -1 }),
    ]);
    const withoutId = { projection: { _id: 0 } };

    return {
        name: "MongoDB Atlas",
        ping: () => db.command({ ping: 1 }),
        putBoard: (board) => boards.replaceOne({ _id: board.shareId }, { _id: board.shareId, ...board }, { upsert: true }),
        getBoardByKey: (shareId) => boards.findOne({ _id: shareId }, withoutId),
        getBoardByShareId: (shareId) => boards.findOne({ shareId }, withoutId),
        setElements: (shareId, patch) =>
            boards.updateOne(
                { _id: shareId },
                { $set: Object.fromEntries(Object.entries(patch).map(([elementId, element]) => [`elements.${elementId}`, element])) },
            ),
        appendOps: (batch) =>
            ops.insertMany(
                batch.map((op) => ({ ...op })),
                { ordered: false },
            ),
        readOpsAfter: (shareId, afterSeq) =>
            ops
                .find({ shareId, seq: { $gt: afterSeq } }, withoutId)
                .sort({ seq: 1 })
                .toArray(),
        putSnapshot: (snapshot) => snapshots.replaceOne({ shareId: snapshot.shareId, seq: snapshot.seq }, snapshot, { upsert: true }),
        latestSnapshotAtOrBefore: (shareId, seq) =>
            snapshots.findOne({ shareId, seq: { $lte: seq } }, { sort: { seq: -1 }, projection: { _id: 0, shareId: 1, seq: 1 } }),
        listBoardsByOwner: (owner) =>
            boards
                .find({ owner }, { projection: { _id: 0, shareId: 1, title: 1, createdAt: 1 } })
                .sort({ createdAt: -1 })
                .toArray(),
        settle: () => Promise.resolve(),
        teardown: async ({ keep }) => {
            if (!keep) await db.dropDatabase();
            await client.close();
        },
    };
};
