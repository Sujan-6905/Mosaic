import "../db/connection.js";
import { Schema, model } from "ottoman";

// One row per person and board, so collaborators file and star a shared board independently.
const boardOrganizationSchema = new Schema(
    {
        userId: { type: String, required: true },
        shareId: { type: String, required: true },
        categoryId: { type: String, default: null },
        favorite: { type: Boolean, default: false },
    },
    { timestamps: true },
);

boardOrganizationSchema.index.findByUserId = { by: "userId", type: "n1ql" };
boardOrganizationSchema.index.findByShareId = { by: "shareId", type: "n1ql" };

const BoardOrganization = model("BoardOrganization", boardOrganizationSchema, {
    collectionName: "boardOrganizations",
    scopeName: "app",
    idKey: "_id",
});

export default BoardOrganization;
