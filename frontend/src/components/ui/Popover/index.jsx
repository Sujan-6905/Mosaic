import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cx from "clsx";
import Panel from "../Panel";
import styles from "./index.module.css";

const GAP = 8;
const VIEWPORT_MARGIN = 8;

// Portals into document.body so no ancestor's stacking context or overflow can hide or clip the content.
const Popover = ({ trigger, children, align = "start", isOpen: controlledOpen, onOpenChange, className }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = (next) => {
        if (!isControlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
    };
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const contentRef = useRef(null);
    const [style, setStyle] = useState(null);

    useLayoutEffect(() => {
        if (!open) return;
        const onPointerDown = (e) => {
            if (rootRef.current?.contains(e.target)) return;
            if (contentRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        // Capture and stop, so Escape closes only this popover rather than
        // also clearing the board selection it was opened from.
        const onKeyDown = (e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Renders hidden first to measure its real size, then places it on whichever side of the trigger has room,
    // clamping horizontally to the viewport. Content taller than that side scrolls rather than covering the trigger.
    useLayoutEffect(() => {
        if (!open) {
            setStyle(null);
            return;
        }
        const reposition = () => {
            const anchor = triggerRef.current?.getBoundingClientRect();
            const content = contentRef.current?.getBoundingClientRect();
            if (!anchor || !content) return;
            const naturalHeight = Math.max(content.height, contentRef.current.scrollHeight);
            const spaceBelow = window.innerHeight - anchor.bottom - GAP - VIEWPORT_MARGIN;
            const spaceAbove = anchor.top - GAP - VIEWPORT_MARGIN;
            const opensUp = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
            const maxHeight = Math.max(0, opensUp ? spaceAbove : spaceBelow);
            const height = Math.min(naturalHeight, maxHeight);
            const rawLeft =
                align === "end" ? anchor.right - content.width : align === "center" ? anchor.left + anchor.width / 2 - content.width / 2 : anchor.left;
            const maxLeft = window.innerWidth - content.width - VIEWPORT_MARGIN;
            const left = Math.max(VIEWPORT_MARGIN, Math.min(rawLeft, Math.max(VIEWPORT_MARGIN, maxLeft)));
            const top = opensUp ? anchor.top - GAP - height : anchor.bottom + GAP;
            setStyle({ position: "fixed", left, top, maxHeight });
        };
        reposition();
        // Content can grow after the first measurement (ColorPicker's recents load late), so a resize repositions it.
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(reposition) : null;
        if (contentRef.current) observer?.observe(contentRef.current);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [open, align, children]);

    return (
        <div ref={rootRef} className={cx(styles.root, className)}>
            <span ref={triggerRef} onClick={() => setOpen(!open)}>
                {trigger}
            </span>
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <Panel
                        ref={contentRef}
                        elevation="md"
                        className={cx(styles.content, { [styles.measuring]: !style })}
                        style={style || { position: "fixed", top: 0, left: 0 }}
                    >
                        {children}
                    </Panel>,
                    document.body,
                )}
        </div>
    );
};

export default Popover;
