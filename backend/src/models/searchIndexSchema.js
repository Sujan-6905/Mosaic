import "../db/connection.js";
import { Schema, model } from "ottoman";

// One document per board, rebuilt whole on each autosave flush. Chunks are plain objects.
const searchIndexSchema = new Schema(
    {
        shareId: { type: String, required: true },
        title: { type: String, default: "" },
        chunks: { type: [Schema.Types.Mixed], default: [] },
    },
    { timestamps: true },
);

searchIndexSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const SearchIndex = model("SearchIndex", searchIndexSchema, {
    collectionName: "searchIndexes",
    scopeName: "app",
    idKey: "_id",
});

export default SearchIndex;
