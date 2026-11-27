import "../db/connection.js";
import { Schema, model } from "ottoman";

// A cover letter: a public, read-only link that plays one board drawing itself for one reader.
// `token` is the only thing that opens it; revoking deletes the row.
const letterSchema = new Schema(
    {
        token: { type: String, required: true },
        shareId: { type: String, required: true },
        ownerId: { type: String, required: true },
        company: { type: String, required: true },
        note: { type: String },
    },
    { timestamps: true },
);

letterSchema.index.findByToken = { by: "token", type: "n1ql" };
letterSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const Letter = model("Letter", letterSchema, {
    collectionName: "letters",
    scopeName: "app",
    idKey: "_id",
});

export default Letter;
