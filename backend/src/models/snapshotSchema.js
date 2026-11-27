import "../db/connection.js";
import { Schema, model } from "ottoman";

// A replay starting point and the thing a history entry points at. Automatic ones follow the
// snapshot cadence; a named one is written at once with `automatic: false`.
const snapshotSchema = new Schema(
    {
        shareId: { type: String, required: true },
        seq: { type: Number, required: true },
        elements: { type: Schema.Types.Mixed, default: {} },
        background: { type: Schema.Types.Mixed, default: { type: "blank", colorToken: null } },
        name: { type: String, default: null },
        automatic: { type: Boolean, default: true },
        authorId: { type: String, default: null },
        authorName: { type: String, default: null },
        // Precomputed so the history panel needs no op-log query per row.
        contributors: { type: [String], default: [] },
    },
    { timestamps: true },
);

snapshotSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const Snapshot = model("Snapshot", snapshotSchema, {
    collectionName: "snapshots",
    scopeName: "app",
    idKey: "_id",
});

export default Snapshot;
