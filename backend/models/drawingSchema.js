import mongoose from "mongoose";

const drawingSchema = new mongoose.Schema({
  title: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shared: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  shareId: String,
  elements: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

drawingSchema.statics.createDrawing = async function ({
  title,
  shareId,
  ownerId,
}) {
  try {
    const newDrawing = new this({ title, shareId, owner: ownerId });

    const savedDrawing = await newDrawing.save();

    return savedDrawing;
  } catch (error) {
    console.log("error creating a canvas", error);
  }
};

drawingSchema.methods.hasEditAccess = function (userId) {
  return (
    this.owner.equals(userId) ||
    this.shared.some((sharedUserId) => sharedUserId.equals(userId))
  );
};

drawingSchema.methods.hasDeleteAccess = function (userId) {
  return this.owner.equals(userId);
};

const Drawing = mongoose.model("Drawing", drawingSchema);

export default Drawing;
