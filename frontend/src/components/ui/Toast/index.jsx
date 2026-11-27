import { useCallback, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faInfoCircle, faCheckCircle, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import styles from "./index.module.css";
import cx from "clsx";
import { isErrorToastSuppressed } from "@/lib/axiosInstance";

let toastId = 0;

const Toast = ({ toasts, removeToast }) => {
    return (
        <div className={styles.toastContainer}>
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cx(styles.toast, styles[toast.type], {
                        [styles.entering]: toast.entering,
                        [styles.exiting]: toast.exiting,
                    })}
                >
                    <div className={styles.toastIcon}>
                        <FontAwesomeIcon icon={toast.type === "success" ? faCheckCircle : toast.type === "warning" ? faExclamationTriangle : faInfoCircle} />
                    </div>
                    <div className={styles.toastContent}>
                        <div className={styles.toastTitle}>{toast.title}</div>
                        {toast.message && <div className={styles.toastMessage}>{toast.message}</div>}
                    </div>
                    <button className={styles.toastClose} onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            ))}
        </div>
    );
};

// Stable across renders, so effects can depend on showToast without re-running.
export const useToast = () => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2000);
    }, []);

    const addToast = useCallback(
        (toast) => {
            const id = ++toastId;
            setToasts((prev) => [...prev, { id, entering: true, ...toast }]);
            setTimeout(() => {
                setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, entering: false } : t)));
            }, 2000);
            setTimeout(() => removeToast(id), toast.duration || 2000);
        },
        [removeToast],
    );

    const showToast = useMemo(
        () => ({
            info: (title, message, duration) => addToast({ type: "info", title, message, duration }),
            success: (title, message, duration) => addToast({ type: "success", title, message, duration }),
            warning: (title, message, duration) => addToast({ type: "warning", title, message, duration }),
            // Muted while an expired session is being handled, so one "session expired" toast isn't joined by every failed request's.
            error: (title, message, duration) => {
                if (isErrorToastSuppressed()) return;
                addToast({ type: "error", title, message, duration });
            },
        }),
        [addToast],
    );

    return { toasts, removeToast, showToast };
};

export default Toast;
