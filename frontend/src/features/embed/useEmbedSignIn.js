import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL;
const RENEW_BEFORE_MS = 60 * 1000;
const POPUP_FEATURES = "popup,width=480,height=640";

// A cross-site frame usually can't see Mosaic's sign-in: storage access covers browsers that grant it,
// and a small Mosaic window handing back a sign-in for this one board covers the rest.
const askForStorageAccess = async () => {
    if (typeof document.requestStorageAccess !== "function") return false;
    try {
        if (await document.hasStorageAccess()) return true;
        await document.requestStorageAccess();
        return true;
    } catch {
        return false;
    }
};

const signInThroughPopup = (shareId) =>
    new Promise((resolve, reject) => {
        const popup = window.open(`/embed/connect?shareId=${encodeURIComponent(shareId)}`, "mosaic-embed-sign-in", POPUP_FEATURES);
        if (!popup) return reject(new Error("The sign-in window was blocked."));
        const finish = (outcome) => {
            clearInterval(watcher);
            window.removeEventListener("message", onMessage);
            outcome();
        };
        const onMessage = (event) => {
            if (event.origin !== window.location.origin || event.source !== popup || event.data?.type !== "mosaic:embedSession") return;
            finish(() => resolve(event.data.session));
        };
        const watcher = setInterval(() => popup.closed && finish(() => reject(new Error("The sign-in window was closed."))), 500);
        window.addEventListener("message", onMessage);
        return undefined;
    });

// The visitor's Mosaic session when it reaches the frame, else a board-only sign-in from the popup,
// renewed in the background like any other.
export default function useEmbedSignIn(shareId) {
    const { data: session, update } = useSession();
    const [granted, setGranted] = useState(null);

    useEffect(() => {
        if (!granted) return undefined;
        const wait = Math.max(5000, granted.accessTokenExpiresAt - Date.now() - RENEW_BEFORE_MS);
        const timer = setTimeout(async () => {
            const response = await fetch(`${API}/api/auth/session/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: granted.refreshToken }),
            }).catch(() => null);
            setGranted(response?.ok ? { ...granted, ...(await response.json()) } : null);
        }, wait);
        return () => clearTimeout(timer);
    }, [granted]);

    const signIn = useCallback(async () => {
        if ((await askForStorageAccess()) && (await update())?.accessToken) return;
        setGranted(await signInThroughPopup(shareId));
    }, [shareId, update]);

    const token = session?.accessToken && !session.error ? session.accessToken : (granted?.token ?? null);
    return { token, signIn };
}
