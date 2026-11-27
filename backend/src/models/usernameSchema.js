import "../db/connection.js";
import { Schema, model } from "ottoman";

// Registered only to provision the collection; uniqueness uses an atomic reserved-key insert,
// not a read-then-write.
const usernameSchema = new Schema({ userId: { type: String, required: true } }, { timestamps: true });

const Username = model("Username", usernameSchema, {
    collectionName: "usernames",
    scopeName: "app",
    idKey: "_id",
});

export default Username;
