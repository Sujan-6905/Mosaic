// The browser half of mention notifications: one service worker, and a push
// subscription per browser that the server is told about.
import axiosInstance from "./axiosInstance";

const WORKER_URL = "/push-sw.js";

export class PushPermissionDenied extends Error {}

export const browserCanPush = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// iPhone and iPad only allow it from Mosaic added to the Home Screen.
export const isAppleMobile = () =>
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const keyBytes = (base64Url) => {
    const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
};

export const currentPushSubscription = async () => {
    const registration = await navigator.serviceWorker.getRegistration(WORKER_URL);
    return registration ? registration.pushManager.getSubscription() : null;
};

export const subscribeToPush = async (publicKey) => {
    if ((await Notification.requestPermission()) !== "granted") throw new PushPermissionDenied();
    await navigator.serviceWorker.register(WORKER_URL);
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
};

// A person signing out of a shared computer stops getting their mentions on it.
// The server forgets the subscription when its next push is refused.
export const forgetPushInThisBrowser = async () => {
    if (!browserCanPush()) return;
    try {
        await (await currentPushSubscription())?.unsubscribe();
    } catch {
        // Nothing subscribed, or the browser refused; signing out goes ahead either way.
    }
};

let resynced = false;

// The server ties a subscription to the sign-in that registered it, so a new
// sign-in in a browser that already has one tells the server again, once per page load.
export const resyncPushSubscription = async (token) => {
    if (resynced || !token || !browserCanPush() || Notification.permission !== "granted") return;
    resynced = true;
    try {
        const subscription = await currentPushSubscription();
        if (subscription) await axiosInstance.post("/api/push/subscriptions", subscription.toJSON(), { headers: { Authorization: `Bearer ${token}` } });
    } catch {
        // The Profile switch shows the real state the next time it's opened.
    }
};
