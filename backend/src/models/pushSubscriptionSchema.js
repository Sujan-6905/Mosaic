import "../db/connection.js";
import { Schema, model } from "ottoman";

// One browser that asked to be told about mentions while its person is away.
const pushSubscriptionSchema = new Schema(
    {
        userId: { type: String, required: true },
        // The browser sign-in that turned it on; the subscription ends with it.
        sid: { type: String, required: true },
        endpoint: { type: String, required: true },
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
    },
    { timestamps: true },
);

pushSubscriptionSchema.index.findByUserId = { by: "userId", type: "n1ql" };

const PushSubscription = model("PushSubscription", pushSubscriptionSchema, {
    collectionName: "pushSubscriptions",
    scopeName: "app",
    idKey: "_id",
});

export default PushSubscription;
