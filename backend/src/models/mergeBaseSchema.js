import "../db/connection.js";
import { Schema, model } from "ottoman";

// The last state a branch and its origin agreed on, keyed by the branch, kept apart from
// version history (which compacts) so a later merge has an exact base.
const mergeBaseSchema = new Schema(
    {
        elements: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
);

const MergeBase = model("MergeBase", mergeBaseSchema, {
    collectionName: "mergeBases",
    scopeName: "app",
    idKey: "_id",
});

export const saveMergeBase = async (branchShareId, elements) => {
    const existing = await MergeBase.findById(branchShareId).catch(() => null);
    if (existing) return MergeBase.replaceById(branchShareId, { elements });
    return MergeBase.create({ _id: branchShareId, elements });
};

export const loadMergeBase = async (branchShareId) => (await MergeBase.findById(branchShareId).catch(() => null))?.elements ?? null;

export default MergeBase;
