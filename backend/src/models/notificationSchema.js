import "../db/connection.js";
import { Schema, model } from "ottoman";

// One row per thing a person should hear about while away from the board it happened on.
const notificationSchema = new Schema(
    {
        userId: { type: String, required: true },
        kind: { type: String, required: true },
        shareId: { type: String, required: true },
        boardTitle: String,
        actorId: String,
        actorName: String,
        preview: String,
        commentId: String,
        readAt: { type: String },
    },
    { timestamps: true },
);

notificationSchema.index.findByUserId = { by: "userId", type: "n1ql" };

const Notification = model("Notification", notificationSchema, {
    collectionName: "notifications",
    scopeName: "app",
    idKey: "_id",
});

export default Notification;
