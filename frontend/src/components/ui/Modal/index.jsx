import { useEffect, useRef } from "react";
import usePresence from "@/hooks/usePresence";
import Panel from "../Panel";
import StrokeIcon from "../StrokeIcon";
import styles from "./index.module.css";

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EXIT_MS = 160;

const Modal = ({ isOpen, onClose, title, children, footer, size = "md" }) => {
    const panelRef = useRef(null);
    const { mounted, closing } = usePresence(isOpen, EXIT_MS);
    // Callers often pass an inline onClose; reading it through a ref keeps
    // the effect below from re-running, and re-focusing the panel, on every render.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                onCloseRef.current?.();
                return;
            }
            // Focus trap: Tab and Shift+Tab wrap within the dialog instead of escaping to the page.
            if (e.key !== "Tab" || !panelRef.current) return;
            const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        // An autoFocus child has already taken focus by now; keep it there.
        if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isOpen]);

    if (!mounted) return null;

    return (
        // Never stop pointerdown in the capture phase here: it blinds menus inside the modal to their own press,
        // and Base UI then treats the click as a second toggle and closes.
        <div className={styles.overlay} onClick={onClose} data-board-chrome data-closing={closing || undefined}>
            <Panel
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                elevation="lg"
                padded={false}
                className={styles.modal + " " + styles[size]}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <h3 className={styles.title}>{title}</h3>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                        <StrokeIcon name="close" size={13} strokeWidth={2.4} />
                    </button>
                </div>
                <div className={styles.body}>{children}</div>
                {footer && <div className={styles.footer}>{footer}</div>}
            </Panel>
        </div>
    );
};

export default Modal;
