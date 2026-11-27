import { sendNotification, setVapidDetails } from "web-push";
import { getDefaultInstance } from "ottoman";
import PushSubscription from "../models/pushSubscriptionSchema.js";
import { isSignInLive, signInEvents } from "../auth/sessionTokens.js";
import logger from "../observability/logger.js";

const keyspace = () => `\`${process.env.CB_BUCKET_NAME}\`.\`app\`.\`pushSubscriptions\``;
const MESSAGE_TTL_SECONDS = 24 * 60 * 60;
const PREVIEW_LENGTH = 140;
// The browsers' own push services. The server posts to whatever address a
// browser registers, so anything else would let a person aim it at other hosts.
const PUSH_SERVICE_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

export const isPushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const pushPublicKey = () => (isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null);

export const isPushServiceEndpoint = (endpoint) => {
    try {
        const url = new URL(endpoint);
        return url.protocol === "https:" && !url.port && PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
        return false;
    }
};

// Push services want a way to reach whoever sends: VAPID_SUBJECT, else the app's
// own https address. A local http address isn't accepted, hence the placeholder.
const vapidSubject = () => {
    if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
    if (process.env.PUBLIC_APP_URL?.startsWith("https://")) return process.env.PUBLIC_APP_URL;
    return "mailto:notifications@mosaic.invalid";
};

let configured = false;
const configure = () => {
    if (configured) return;
    setVapidDetails(vapidSubject(), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = true;
};

const removeByEndpoint = (endpoint, userId = null) =>
    getDefaultInstance().query(`DELETE FROM ${keyspace()} AS s WHERE s.endpoint = $endpoint${userId ? " AND s.userId = $userId" : ""}`, {
        parameters: { endpoint, ...(userId ? { userId } : {}) },
    });

export class SubscriptionHeldElsewhere extends Error {}

// Resubscribing moves the row to the current sign-in. Taking over another account's row needs
// that browser's own keys, so knowing an address isn't enough.
export const saveSubscription = async (userId, sid, { endpoint, keys }) => {
    const { rows } = await getDefaultInstance().query(`SELECT s.userId, s.p256dh, s.auth FROM ${keyspace()} AS s WHERE s.endpoint = $endpoint`, {
        parameters: { endpoint },
    });
    if (rows.some((row) => row.userId !== userId && (row.p256dh !== keys.p256dh || row.auth !== keys.auth))) throw new SubscriptionHeldElsewhere();
    await removeByEndpoint(endpoint);
    await PushSubscription.create({ userId, sid, endpoint, p256dh: keys.p256dh, auth: keys.auth });
};

export const removeSubscription = (userId, endpoint) => removeByEndpoint(endpoint, userId);

const removeBySid = (sid) => getDefaultInstance().query(`DELETE FROM ${keyspace()} AS s WHERE s.sid = $sid`, { parameters: { sid } });

// A device whose sign-in ended (signed out, signed out by another device, a
// password change) stops hearing about mentions at once.
export const forgetSubscriptionsOfEndedSignIns = () => {
    signInEvents.on("ended", (sid) => {
        removeBySid(sid).catch((error) => logger.warn({ err: error }, "couldn't forget the notifications of an ended sign-in"));
    });
};

// Only browsers whose sign-in is still on; one that expired is dropped on the way.
const subscriptionsOf = async (userId) => {
    const { rows } = await getDefaultInstance().query(`SELECT s.sid, s.endpoint, s.p256dh, s.auth FROM ${keyspace()} AS s WHERE s.userId = $userId`, {
        parameters: { userId },
    });
    const live = await Promise.all(rows.map((row) => (row.sid ? isSignInLive(row.sid) : false)));
    await Promise.all(rows.filter((_, i) => !live[i]).map((row) => removeByEndpoint(row.endpoint)));
    return rows.filter((_, i) => live[i]);
};

export const mentionMessage = ({ actorName, boardTitle, preview, shareId, commentId }) => ({
    title: `${actorName || "Someone"} mentioned you`,
    body: [boardTitle ? `On ${boardTitle}` : null, preview ? preview.slice(0, PREVIEW_LENGTH) : null].filter(Boolean).join(": "),
    url: `/?shareId=${encodeURIComponent(shareId)}`,
    tag: `mention:${commentId ?? shareId}`,
});

// Sends to each browser the person turned this on in. One the push service no
// longer knows (404 or 410) is forgotten so it isn't tried again.
export const pushToUser = async (userId, message, { send = sendNotification } = {}) => {
    if (!isPushConfigured()) return 0;
    configure();
    const payload = JSON.stringify(message);
    const results = await Promise.allSettled(
        (await subscriptionsOf(userId)).map(async ({ endpoint, p256dh, auth }) => {
            try {
                await send({ endpoint, keys: { p256dh, auth } }, payload, { TTL: MESSAGE_TTL_SECONDS });
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) await removeByEndpoint(endpoint);
                else logger.warn({ err: error, statusCode: error.statusCode }, "a push message wasn't accepted");
                throw error;
            }
        }),
    );
    return results.filter((result) => result.status === "fulfilled").length;
};
