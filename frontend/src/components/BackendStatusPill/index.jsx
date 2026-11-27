import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { watchBackend } from "@/lib/backendWake";
import styles from "./index.module.css";

const READY_LINGER_MS = 3_000;

const MESSAGES = {
    waking: "The server is waking up after a quiet spell. That usually takes under a minute, sometimes a few. Look around while it starts.",
    unreachable: "The server still isn't answering. Check your connection, then try again.",
    ready: "The server is up. Boards, sign-in and the assistant are ready.",
};

// The free-tier backend sleeps when idle; the first probe wakes it, and this says so while it starts.
const BackendStatusPill = () => {
    const dispatch = useDispatch();
    const status = useSelector((state) => state.connection.backendStatus);
    const wasWaiting = useRef(false);
    const [showReady, setShowReady] = useState(false);

    useEffect(() => watchBackend(dispatch), [dispatch]);

    useEffect(() => {
        if (status === "waking" || status === "unreachable") wasWaiting.current = true;
        if (status !== "ready" || !wasWaiting.current) return;
        wasWaiting.current = false;
        setShowReady(true);
        const timer = setTimeout(() => setShowReady(false), READY_LINGER_MS);
        return () => clearTimeout(timer);
    }, [status]);

    const visible = status === "waking" || status === "unreachable" || showReady;
    if (!visible) return null;

    return (
        <div className={styles.dock}>
            <div className={styles.pill} data-status={status} role="status">
                <span className={styles.tiles} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                </span>
                <span className={styles.message}>{MESSAGES[status]}</span>
                {status === "unreachable" && (
                    <button type="button" className={styles.retry} onClick={() => watchBackend(dispatch)}>
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
};

export default BackendStatusPill;
