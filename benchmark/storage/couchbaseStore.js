import { requireFromBackend } from "../packageResolution.js";

const couchbase = requireFromBackend("couchbase");

const SCOPE = "bench";
const COLLECTIONS = ["boards", "ops", "snapshots"];
const INDEXES = [
    "CREATE INDEX bench_boards_share IF NOT EXISTS ON {boards}(shareId)",
    "CREATE INDEX bench_boards_owner IF NOT EXISTS ON {boards}(owner, createdAt)",
    "CREATE INDEX bench_ops_share_seq IF NOT EXISTS ON {ops}(shareId, seq)",
    "CREATE INDEX bench_snapshots_share_seq IF NOT EXISTS ON {snapshots}(shareId, seq)",
];
const isAlreadyThere = (error) => /exists/i.test(error?.message ?? "") || error?.name?.includes("Exists");

// Mirrors the app's Couchbase use: KV gets and sub-document writes by key, SQL++ over secondary indexes for lookups.
export const openCouchbase = async (env = process.env) => {
    const bucketName = env.CB_BUCKET_NAME;
    const cluster = await couchbase.connect(env.CB_CONNECTION_STRING, { username: env.CB_USERNAME, password: env.CB_PASSWORD });
    const bucket = cluster.bucket(bucketName);
    const keyspace = (name) => `\`${bucketName}\`.\`${SCOPE}\`.\`${name}\``;
    const collection = (name) => bucket.scope(SCOPE).collection(name);
    const query = async (statement, parameters, consistent = false) =>
        (
            await cluster.query(statement, {
                parameters,
                ...(consistent ? { scanConsistency: couchbase.QueryScanConsistency.RequestPlus } : {}),
            })
        ).rows;

    const manager = bucket.collections();
    await manager.createScope(SCOPE).catch((error) => {
        if (!isAlreadyThere(error)) throw error;
    });
    for (const name of COLLECTIONS)
        await manager.createCollection({ name, scopeName: SCOPE }).catch((error) => {
            if (!isAlreadyThere(error)) throw error;
        });
    for (const statement of INDEXES) await query(statement.replace(/\{(\w+)\}/g, (_, name) => keyspace(name)));
    // A run stopped part way leaves its documents behind, and seeding inserts.
    for (const name of COLLECTIONS) await query(`DELETE FROM ${keyspace(name)} AS d WHERE d.shareId IS NOT MISSING`, [], true);

    const opKey = (op) => `${op.shareId}::${op.seq}`;
    const snapshotKey = (snapshot) => `${snapshot.shareId}::${snapshot.seq}`;

    return {
        name: "Couchbase Capella",
        ping: async () => {
            await collection("boards").exists("bench-ping");
        },
        putBoard: (board) => collection("boards").upsert(board.shareId, board),
        getBoardByKey: async (shareId) => (await collection("boards").get(shareId)).content,
        getBoardByShareId: async (shareId) => (await query(`SELECT b.* FROM ${keyspace("boards")} AS b WHERE b.shareId = $1 LIMIT 1`, [shareId]))[0],
        setElements: (shareId, patch) =>
            collection("boards").mutateIn(
                shareId,
                Object.entries(patch).map(([elementId, element]) => couchbase.MutateInSpec.upsert(`elements.${elementId}`, element)),
            ),
        appendOps: (ops) => Promise.all(ops.map((op) => collection("ops").insert(opKey(op), op))),
        readOpsAfter: (shareId, afterSeq) =>
            query(`SELECT o.* FROM ${keyspace("ops")} AS o WHERE o.shareId = $1 AND o.seq > $2 ORDER BY o.seq`, [shareId, afterSeq]),
        putSnapshot: (snapshot) => collection("snapshots").upsert(snapshotKey(snapshot), snapshot),
        latestSnapshotAtOrBefore: async (shareId, seq) =>
            (
                await query(`SELECT s.shareId, s.seq FROM ${keyspace("snapshots")} AS s WHERE s.shareId = $1 AND s.seq <= $2 ORDER BY s.seq DESC LIMIT 1`, [
                    shareId,
                    seq,
                ])
            )[0],
        listBoardsByOwner: (owner) =>
            query(`SELECT b.shareId, b.title, b.createdAt FROM ${keyspace("boards")} AS b WHERE b.owner = $1 ORDER BY b.createdAt DESC`, [owner]),
        // Waits for the indexes to see every write, so timed reads never race the setup.
        settle: () =>
            Promise.all(COLLECTIONS.map((name) => query(`SELECT COUNT(1) AS n FROM ${keyspace(name)} AS d WHERE d.shareId IS NOT MISSING`, [], true))),
        teardown: async ({ keep }) => {
            if (!keep) await manager.dropScope(SCOPE).catch((error) => console.warn(`Couldn't drop the ${SCOPE} scope: ${error.message}`));
            await cluster.close();
        },
    };
};
