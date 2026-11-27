import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import Switch from "@/components/ui/Switch";
import { browserCanPush, currentPushSubscription, isAppleMobile, PushPermissionDenied, subscribeToPush } from "@/lib/webPush";
import styles from "./profile.module.css";
import own from "./MentionAlerts.module.css";

const NOTES = {
    unsupported: "This browser can't show notifications from websites.",
    apple: "On iPhone and iPad, add Mosaic to your Home Screen from the Share menu, open it from there, then turn this on.",
    blocked: "Notifications are blocked for Mosaic in this browser. Allow them in the site settings next to the address bar, then turn this on.",
};

// Mentions reach this browser while Mosaic is closed. It's per browser, so a phone and a laptop are each turned on in their own.
export default function MentionAlerts({ token, showToast }) {
    const [publicKey, setPublicKey] = useState(null);
    const [state, setState] = useState("checking");
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            if (!browserCanPush()) return isAppleMobile() ? "apple" : "unsupported";
            const { data } = await axiosInstance.get("/api/push/key");
            if (!data.publicKey) return "unavailable";
            if (!cancelled) setPublicKey(data.publicKey);
            if (Notification.permission === "denied") return "blocked";
            const subscription = await currentPushSubscription();
            if (!subscription) return "off";
            // Tells the server again, so a browser shared by two accounts notifies whoever signed in last.
            await axiosInstance.post("/api/push/subscriptions", subscription.toJSON(), authHeaders);
            return "on";
        };
        check()
            .then((next) => !cancelled && setState(next))
            .catch(() => !cancelled && setState("off"));
        return () => {
            cancelled = true;
        };
        // The token only changes on renewal, which needs no new check.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const turnOn = async () => {
        setState("busy");
        try {
            const subscription = await subscribeToPush(publicKey);
            await axiosInstance.post("/api/push/subscriptions", subscription.toJSON(), authHeaders);
            setState("on");
            showToast?.success("Notifications on", "You'll hear about mentions in this browser");
        } catch (error) {
            if (error instanceof PushPermissionDenied) {
                setState(Notification.permission === "denied" ? "blocked" : "off");
                return;
            }
            setState("off");
            showToast?.error("Couldn't turn notifications on", error.response?.data?.message || "Try again in a moment");
        }
    };

    const turnOff = async () => {
        setState("busy");
        try {
            const subscription = await currentPushSubscription();
            if (subscription) {
                await axiosInstance.delete("/api/push/subscriptions", { ...authHeaders, data: { endpoint: subscription.endpoint } });
                await subscription.unsubscribe();
            }
            setState("off");
        } catch {
            setState("on");
            showToast?.error("Couldn't turn notifications off", "Try again in a moment");
        }
    };

    if (state === "checking" || state === "unavailable") return null;

    return (
        <section className={styles.card} data-rise style={{ "--rise-order": 4 }} aria-labelledby="mentionAlertsHeading">
            <div className={styles.cardHead}>
                <h2 id="mentionAlertsHeading">Mention notifications</h2>
                <p>
                    When someone mentions you in a comment and you don&apos;t have that board open, this browser shows a notification. Each browser is set on
                    its own.
                </p>
            </div>
            {NOTES[state] ? (
                <p className={own.note} role="note">
                    {NOTES[state]}
                </p>
            ) : (
                <Switch checked={state === "on"} onChange={(next) => state !== "busy" && (next ? turnOn() : turnOff())} className={styles.settingSwitch}>
                    <span>{state === "busy" ? "Working on it" : "Notify me in this browser"}</span>
                </Switch>
            )}
        </section>
    );
}
