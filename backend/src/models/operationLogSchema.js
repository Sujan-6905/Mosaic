import "../db/connection.js";
import { Schema, model } from "ottoman";

// One append-only row per accepted mutation. Only `after` is stored: replay and diffs work
// from reconstructed states, never from `before`.
const operationLogSchema = new Schema(
    {
        shareId: { type: String, required: true },
        seq: { type: Number, required: true },
        opType: { type: String, required: true }, // "insert" | "update" | "delete" | "background"
        elementId: { type: String, default: null }, // null for a "background" op
        after: { type: Schema.Types.Mixed, default: null },
        authorId: { type: String, required: true },
        authorName: { type: String, default: null },
        // On an agent's op only: authorId is still the person who asked, agentId the agent, and
        // correlationId ties the batch to that turn's logs.
        agentId: { type: String, default: null },
        correlationId: { type: String, default: null },
        ts: { type: Number, required: true },
    },
    { timestamps: true },
);

operationLogSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const OperationLog = model("OperationLog", operationLogSchema, {
    collectionName: "operationLogs",
    scopeName: "app",
    idKey: "_id",
});

export default OperationLog;
