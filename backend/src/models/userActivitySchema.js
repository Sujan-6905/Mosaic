import "../db/connection.js";
import { Schema, model } from "ottoman";

// One document per person per year: pieces set each day, the boards they were set on,
// and when each first happened. Written by subdocument increments and read by key (services/userActivity.js).
const userActivitySchema = new Schema({
    userId: { type: String, required: true },
    year: { type: Number, required: true },
    days: { type: Schema.Types.Mixed, default: {} },
    firsts: { type: Schema.Types.Mixed, default: {} },
});

const UserActivity = model("UserActivity", userActivitySchema, {
    collectionName: "userActivity",
    scopeName: "app",
    idKey: "_id",
});

export default UserActivity;
