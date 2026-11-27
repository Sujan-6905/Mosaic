import "../db/connection.js";
import { Schema, model } from "ottoman";

// Registered only so the collection is provisioned at boot: the wall writes raw
// keys, because a stone and a visitor's one claim must each be an atomic insert.
const wallStoneSchema = new Schema({ at: { type: Number } }, { timestamps: false });

const WallStone = model("WallStone", wallStoneSchema, {
    collectionName: "wallStones",
    scopeName: "app",
    idKey: "_id",
});

export default WallStone;
