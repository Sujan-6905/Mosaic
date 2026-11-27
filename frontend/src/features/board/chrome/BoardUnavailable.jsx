import { useState } from "react";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosInstance";
import Button from "@/components/ui/Button";
import styles from "./BoardUnavailable.module.css";

const LockIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 11h12v9H6zM9 11V8a3 3 0 016 0v3" />
    </svg>
);

const MissingTileIcon = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 3"
        aria-hidden="true"
    >
        <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
);

const COPY = {
    noAccess: {
        title: "You don't have access to this board",
        icon: LockIcon,
    },
    missing: {
        title: "This board doesn't exist",
        body: "The link may be mistyped, or the board was deleted before you opened it.",
        icon: MissingTileIcon,
    },
    deleted: {
        title: "This board was deleted",
        body: "Its owner deleted it while you had it open, so nothing more can be saved here.",
        icon: MissingTileIcon,
    },
    full: {
        title: "This board is full",
        body: "It already has as many people on it as it allows. Try again once someone leaves.",
        icon: LockIcon,
    },
    tooManyConnections: {
        title: "This board is open in too many of your tabs",
        body: "Close a few of them, then try again here.",
        icon: LockIcon,
    },
    loadFailed: {
        title: "This board couldn't load",
        body: "We couldn't reach the database just now. Your board is safe, so try again in a moment.",
        icon: MissingTileIcon,
    },
};

const RETRYABLE = new Set(["loadFailed", "full", "tooManyConnections"]);

const REQUEST_LABELS = { idle: "Request access", sending: "Asking", sent: "Request sent", failed: "Try asking again" };

export default function BoardUnavailable({ reason, username, shareId, token }) {
    const router = useRouter();
    const [request, setRequest] = useState("idle");

    const requestAccess = async () => {
        setRequest("sending");
        try {
            await axiosInstance.post(`/api/notifications/access-request/${encodeURIComponent(shareId)}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setRequest("sent");
        } catch {
            setRequest("failed");
        }
    };
    const { title, body, icon: Icon } = COPY[reason];
    const retryable = RETRYABLE.has(reason);

    return (
        <div className={styles.backdrop} data-board-chrome>
            <section className={styles.card} role="alertdialog" aria-labelledby="boardUnavailableTitle">
                <span className={styles.icon}>
                    <Icon />
                </span>
                <h1 id="boardUnavailableTitle" className={styles.title}>
                    {title}
                </h1>
                {reason === "noAccess" ? (
                    <p className={styles.body}>
                        {request === "sent" ? (
                            "The owner has your request. Once they let you in, it shows up in your notifications and this link opens the board."
                        ) : (
                            <>
                                Boards only open for people the owner has invited. Ask for access, or ask them to add <strong>@{username}</strong>.
                            </>
                        )}
                    </p>
                ) : (
                    <p className={styles.body}>{body}</p>
                )}
                <div className={styles.actions}>
                    {reason === "noAccess" && shareId && token && (
                        <Button variant="primary" className={styles.pill} onClick={requestAccess} disabled={request === "sending" || request === "sent"}>
                            {REQUEST_LABELS[request]}
                        </Button>
                    )}
                    {retryable && (
                        <Button variant="primary" className={styles.pill} onClick={() => router.reload()}>
                            Try again
                        </Button>
                    )}
                    <Button
                        variant={retryable || reason === "noAccess" ? "secondary" : "primary"}
                        className={styles.pill}
                        onClick={() => router.push("/dashboard")}
                    >
                        Go to all boards
                    </Button>
                    {reason === "noAccess" && username && (
                        <Button variant="secondary" className={styles.pill} onClick={() => navigator.clipboard?.writeText(username)}>
                            Copy my username
                        </Button>
                    )}
                </div>
            </section>
        </div>
    );
}
