import "../db/connection.js";
import { MutateInSpec } from "couchbase";
import { Schema, getDefaultInstance, model } from "ottoman";
import { getRole, hasViewAccess, hasCommentAccess, hasEditAccess, hasDeleteAccess } from "./accessControl.js";
import { buildBoardPreview } from "../services/boardPreview.js";

const COLLECTION_NAME = "drawings";
const SCOPE_NAME = "app";

const drawingSchema = new Schema(
    {
        title: String,
        owner: { type: String, required: true },
        // { userId, role } entries, Mixed because Ottoman's array-of-Schema support is limited.
        collaborators: { type: [Schema.Types.Mixed], default: [] },
        shareId: String,
        elements: { type: Schema.Types.Mixed, default: {} },
        // What the boards list draws, rewritten with every save of `elements` (shared/canvas/boardPreview.js).
        preview: { type: Schema.Types.Mixed, default: null },
        // The GitHub repository this board's architecture diagram follows, if any.
        repoLink: { type: Schema.Types.Mixed, default: null },
        background: { type: Schema.Types.Mixed, default: { type: "blank", colorToken: null } },
        // Bumped when the element shape changes in a way clients must detect.
        schemaVersion: { type: Number, default: 2 },
        // The board and op seq a fork came from; its own log starts at 1. No default, since Ottoman
        // stores a null String default as the text "null".
        parentShareId: { type: String },
        parentSeq: { type: Number, default: null },
        // Who may open the board from its link alone, and as what (models/accessControl.js).
        linkAccess: { type: String, default: "none" },
        // The most an agent acting for a collaborator may do here.
        agentAccess: { type: String, default: "edit" },
        // Off until the owner turns it on; `sites` are the origins allowed to frame the board.
        embed: { type: Schema.Types.Mixed, default: { enabled: false, sites: [] } },
        // When the owner swept the board away; it is purged for good once the grace period passes.
        deletedAt: { type: String },
    },
    { timestamps: true },
);

// `shareId` and `owner` are looked up on nearly every request/socket event.
// The `collaborators` array index can't be declared here; db.js creates it.
drawingSchema.index.findByShareId = { by: "shareId", type: "n1ql" };
drawingSchema.index.findByOwner = { by: "owner", type: "n1ql" };
drawingSchema.index.findByParentShareId = { by: "parentShareId", type: "n1ql" };

// Lets a failed create reach the caller's try/catch instead of reporting success.
drawingSchema.statics.createDrawing = function ({ title, shareId, ownerId }) {
    return this.create({ title, shareId, owner: ownerId });
};

drawingSchema.methods.getRole = function (who) {
    return getRole(this, who);
};

drawingSchema.methods.hasViewAccess = function (who) {
    return hasViewAccess(this, who);
};

drawingSchema.methods.hasCommentAccess = function (who) {
    return hasCommentAccess(this, who);
};

drawingSchema.methods.hasEditAccess = function (who) {
    return hasEditAccess(this, who);
};

drawingSchema.methods.hasDeleteAccess = function (who) {
    return hasDeleteAccess(this, who);
};

// Ottoman saves replace the whole document, so concurrent writers undo each other; this changes
// only the named fields, atomically. Saving `elements` refreshes the list preview too.
const mutateFields = (drawingId, fields) => {
    const specs = Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([path, value]) => MutateInSpec.upsert(path, value));
    return getDefaultInstance().getCollection(COLLECTION_NAME, SCOPE_NAME).mutateIn(`Drawing::${drawingId}`, specs);
};

drawingSchema.statics.writeFields = function (drawingId, fields) {
    const preview = fields.elements === undefined ? undefined : buildBoardPreview(fields.elements);
    return mutateFields(drawingId, { ...fields, preview, updatedAt: new Date().toISOString() });
};

// For a board saved before previews existed: adds one without marking the board as edited.
drawingSchema.statics.writePreview = function (drawingId, elements) {
    const preview = buildBoardPreview(elements);
    return mutateFields(drawingId, { preview }).then(() => preview);
};

// Sweeping or restoring is not an edit, so it leaves updatedAt and the list order alone.
drawingSchema.statics.markSwept = function (drawingId, deletedAt) {
    return mutateFields(drawingId, { deletedAt });
};

const Drawing = model("Drawing", drawingSchema, {
    collectionName: COLLECTION_NAME,
    scopeName: SCOPE_NAME,
    idKey: "_id",
});

export default Drawing;
