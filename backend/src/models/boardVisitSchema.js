import "../db/connection.js";
import { Schema, model } from "ottoman";

// When someone last left a board; kept off Drawing so a write on every disconnect can't
// conflict with other saves.
const boardVisitSchema = new Schema(
    {
        shareId: { type: String, required: true },
        userId: { type: String, required: true },
        lastSeenAt: { type: String, required: true },
    },
    { timestamps: true },
);

boardVisitSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const BoardVisit = model("BoardVisit", boardVisitSchema, {
    collectionName: "boardVisits",
    scopeName: "app",
    idKey: "_id",
});

export default BoardVisit;
