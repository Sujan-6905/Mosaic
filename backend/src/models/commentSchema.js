import "../db/connection.js";
import { Schema, model } from "ottoman";

// A whole thread per document, so resolve and read state are single updates; kept apart from
// elements because comments have their own lifecycle and permissions.
const commentSchema = new Schema(
    {
        shareId: { type: String, required: true },
        // An element anchor follows the element's live bounds, so this document is never rewritten.
        anchorType: { type: String, required: true },
        x: { type: Number, default: null },
        y: { type: Number, default: null },
        elementId: { type: String, default: null },
        authorId: { type: String, required: true },
        authorName: { type: String, required: true },
        text: { type: String, required: true },
        // userIds mentioned in the root message only: a reply's own
        // mentions live inside that reply entry below.
        mentions: { type: [String], default: [] },
        resolved: { type: Boolean, default: false },
        // Drives unread state for mentioned people; the author starts in it.
        readBy: { type: [String], default: [] },
        replies: { type: [Schema.Types.Mixed], default: [] },
    },
    { timestamps: true },
);

commentSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const Comment = model("Comment", commentSchema, {
    collectionName: "comments",
    scopeName: "app",
    idKey: "_id",
});

export default Comment;
