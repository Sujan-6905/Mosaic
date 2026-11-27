import "../db/connection.js";
import { Schema, model } from "ottoman";

// A person's folder in one dashboard section; the section is stored so a board can never
// cross between My Boards and Shared With Me.
const SECTIONS = ["owned", "shared"];

const categorySchema = new Schema(
    {
        userId: { type: String, required: true },
        section: { type: String, required: true },
        name: { type: String, required: true },
        order: { type: Number, default: 0 },
    },
    { timestamps: true },
);

categorySchema.index.findByUserId = { by: "userId", type: "n1ql" };

const Category = model("Category", categorySchema, {
    collectionName: "categories",
    scopeName: "app",
    idKey: "_id",
});

export default Category;
export { SECTIONS };
