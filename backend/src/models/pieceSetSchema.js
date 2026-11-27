import "../db/connection.js";
import { MutateInSpec } from "couchbase";
import { Schema, getDefaultInstance, model } from "ottoman";

const COLLECTION_NAME = "pieceSets";
const SCOPE_NAME = "app";

// A person's own pieces. A published set opens by link and installs as a copy, so later
// edits never reach anyone else's.
const pieceSetSchema = new Schema(
    {
        ownerId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: "" },
        // [{ id, name, elements: { [elementId]: element } }], elements stored around their own top-left.
        pieces: { type: [Schema.Types.Mixed], default: [] },
        published: { type: Boolean, default: false },
        // Listed in the public gallery, which also makes it installable by link.
        listed: { type: Boolean, default: false },
        tags: { type: [String], default: [] },
        // No defaults: Ottoman stores a null String default as the text "null".
        license: { type: String },
        installedFrom: { type: String },
        installs: { type: Number, default: 0 },
    },
    { timestamps: true },
);

pieceSetSchema.index.findByOwnerId = { by: "ownerId", type: "n1ql" };
pieceSetSchema.index.findByListed = { by: "listed", type: "n1ql" };

// Field-level writes, so an owner's edit and someone else's install of the same
// set can't overwrite each other the way a whole-document save would.
const mutate = (setId, specs) =>
    getDefaultInstance()
        .getCollection(COLLECTION_NAME, SCOPE_NAME)
        .mutateIn(`PieceSet::${setId}`, [...specs, MutateInSpec.upsert("updatedAt", new Date().toISOString())]);

pieceSetSchema.statics.writeFields = function (setId, fields) {
    return mutate(
        setId,
        Object.entries(fields)
            .filter(([, value]) => value !== undefined)
            .map(([path, value]) => MutateInSpec.upsert(path, value)),
    );
};
pieceSetSchema.statics.appendPiece = function (setId, piece) {
    return mutate(setId, [MutateInSpec.arrayAppend("pieces", piece)]);
};
pieceSetSchema.statics.countInstall = function (setId) {
    return mutate(setId, [MutateInSpec.increment("installs", 1)]);
};

const PieceSet = model("PieceSet", pieceSetSchema, {
    collectionName: COLLECTION_NAME,
    scopeName: SCOPE_NAME,
    idKey: "_id",
});

export default PieceSet;
