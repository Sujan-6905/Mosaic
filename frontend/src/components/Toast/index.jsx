"use client"

import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes, faInfoCircle, faCheckCircle, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons"
import styles from "./index.module.css"
import cx from "classnames"

let toastId = 0

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
                        <FontAwesomeIcon
                            icon={
                                toast.type === "success"
                                    ? faCheckCircle
                                    : toast.type === "warning"
                                        ? faExclamationTriangle
                                        : faInfoCircle
                            }
                        />
                    </div>
                    <div className={styles.toastContent}>
                        <div className={styles.toastTitle}>{toast.title}</div>
                        {toast.message && <div className={styles.toastMessage}>{toast.message}</div>}
                    </div>
                    <button className={styles.toastClose} onClick={() => removeToast(toast.id)}>
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            ))}
        </div>
    )
}

// Toast hook
export const useToast = () => {
    const [toasts, setToasts] = useState([])

    const addToast = (toast) => {
        const id = ++toastId
        const newToast = { id, entering: true, ...toast }

        setToasts((prev) => [...prev, newToast])

        // Remove entering class after animation
        setTimeout(() => {
            setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, entering: false } : t)))
        }, 2000)

        // Auto remove after duration
        const duration = toast.duration || 2000
        setTimeout(() => {
            removeToast(id)
        }, duration)
    }

    const removeToast = (id) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 2000)
    }

    const showToast = {
        info: (title, message, duration) => addToast({ type: "info", title, message, duration }),
        success: (title, message, duration) => addToast({ type: "success", title, message, duration }),
        warning: (title, message, duration) => addToast({ type: "warning", title, message, duration }),
        error: (title, message, duration) => addToast({ type: "error", title, message, duration }),
    }

    return {
        toasts,
        removeToast,
        showToast,
    }
}

export default Toast

