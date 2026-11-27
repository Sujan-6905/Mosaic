import "../db/connection.js";
import { Schema, model } from "ottoman";

// Registered only to provision the collection; sessionTokens.js uses raw keys with CAS.
const refreshTokenSchema = new Schema({ userId: { type: String, required: true } }, { timestamps: true });

const RefreshToken = model("RefreshToken", refreshTokenSchema, {
    collectionName: "refreshTokens",
    scopeName: "app",
    idKey: "_id",
});

export default RefreshToken;
