import { useEffect } from "react";
import { createPortal } from "react-dom";
import usePresence from "@/hooks/usePresence";
import StrokeIcon from "../StrokeIcon";
import styles from "./index.module.css";

const EXIT_MS = 200;

// A small screen's menu: every action as a labelled tile, grouped, rising from the bottom edge where a thumb is.
// A tile with `keepOpen` toggles in place; any other tile closes the sheet before it runs.
export default function BottomSheet({ isOpen, onClose, title, sections }) {
    const { mounted, closing } = usePresence(isOpen, EXIT_MS);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [isOpen, onClose]);

    if (!mounted || typeof document === "undefined") return null;

    return createPortal(
        <div className={styles.layer} data-closing={closing || undefined} data-board-chrome>
            <button type="button" className={styles.backdrop} aria-label="Close" tabIndex={-1} onClick={onClose} />
            <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
                <header className={styles.head}>
                    <span className={styles.grip} aria-hidden="true" />
                    <h2 className={styles.title}>{title}</h2>
                    <button type="button" className={styles.close} aria-label={`Close ${title}`} onClick={onClose}>
                        <StrokeIcon name="close" size={16} />
                    </button>
                </header>
                <div className={styles.body}>
                    {sections
                        .filter((section) => section.items.length > 0)
                        .map((section) => (
                            <div key={section.title} className={styles.section}>
                                <h3 className={styles.sectionTitle}>{section.title}</h3>
                                <div className={styles.grid} role="group" aria-label={section.title}>
                                    {section.items.map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            className={styles.tile}
                                            aria-pressed={item.active ?? undefined}
                                            data-destructive={item.destructive || undefined}
                                            onClick={() => {
                                                if (!item.keepOpen) onClose();
                                                item.onSelect();
                                            }}
                                        >
                                            <span className={styles.tileIcon}>
                                                {item.swatch ? (
                                                    <span className={styles.swatch} style={{ background: item.swatch }} />
                                                ) : (
                                                    <StrokeIcon name={item.icon} size={20} />
                                                )}
                                                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                                            </span>
                                            <span className={styles.tileLabel}>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            </section>
        </div>,
        document.body,
    );
}
