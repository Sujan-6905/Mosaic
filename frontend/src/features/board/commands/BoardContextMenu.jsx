import { useEffect, useRef } from "react";
import styles from "./BoardContextMenu.module.css";

const VIEWPORT_MARGIN = 8;

// `items` is rows of { label, onSelect, shortcut, danger, disabled }, with
// `null` for a divider.
const BoardContextMenu = ({ x, y, items, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const close = (e) => {
            if (!menuRef.current?.contains(e.target)) onClose();
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener("pointerdown", close, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("pointerdown", close, true);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [onClose]);

    useEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const rect = menu.getBoundingClientRect();
        menu.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - rect.width - VIEWPORT_MARGIN))}px`;
        menu.style.top = `${Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - rect.height - VIEWPORT_MARGIN))}px`;
        menu.querySelector("button:not(:disabled)")?.focus();
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label="Board menu"
            className={styles.menu}
            data-board-chrome
            style={{ left: x, top: y }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) =>
                item === null ? (
                    <span key={`rule-${index}`} className={styles.rule} aria-hidden="true" />
                ) : (
                    <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        data-danger={item.danger || undefined}
                        onClick={() => {
                            onClose();
                            item.onSelect();
                        }}
                    >
                        <span>{item.label}</span>
                        {item.shortcut && <kbd>{item.shortcut}</kbd>}
                    </button>
                ),
            )}
        </div>
    );
};

export default BoardContextMenu;
