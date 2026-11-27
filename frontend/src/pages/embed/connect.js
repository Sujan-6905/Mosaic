import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import styles from "@/features/embed/Embed.module.css";

// Opened by an embed whose frame can't see the sign-in: once signed in here, it hands back a sign-in good for
// that one board and closes.
export default function EmbedConnect({ isAuthenticated, onAuthClick }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [message, setMessage] = useState(null);
    const shareId = typeof router.query.shareId === "string" ? router.query.shareId : null;

    useEffect(() => {
        if (!router.isReady || status === "loading") return;
        if (!isAuthenticated) {
            onAuthClick("login");
            return;
        }
        if (!shareId || !window.opener) {
            setMessage("Open this from a Mosaic embed.");
            return;
        }
        axiosInstance
            .post(`/api/embed/${encodeURIComponent(shareId)}/session`, {}, { headers: { Authorization: `Bearer ${session.accessToken}` } })
            .then(({ data }) => {
                window.opener.postMessage({ type: "mosaic:embedSession", session: data }, window.location.origin);
                window.close();
            })
            .catch((error) =>
                setMessage(error.response?.status === 403 ? "Your account doesn't have access to this board." : "Couldn't sign the embed in. Try again."),
            );
    }, [router.isReady, status, isAuthenticated, shareId, session?.accessToken, onAuthClick]);

    return (
        <>
            <Head>
                <title>Sign in · Mosaic</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <main id="main" className={styles.shell}>
                <div className={styles.stateCard} role="status">
                    <p className={styles.stateTitle}>{message ? "Couldn't connect" : "Connecting the embed"}</p>
                    <p className={styles.stateDetail}>{message ?? (isAuthenticated ? "One moment." : "Sign in to Mosaic to view the board.")}</p>
                    {!isAuthenticated && (
                        <button type="button" className={styles.primary} onClick={() => onAuthClick("login")}>
                            Sign in
                        </button>
                    )}
                </div>
            </main>
        </>
    );
}
