import { cloneElement, forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cx from "clsx";
import styles from "./index.module.css";

const GAP = 8;

const placementFor = (side, anchor, tip) => {
    switch (side) {
        case "top":
            return { top: anchor.top - GAP - tip.height, left: anchor.left + anchor.width / 2 - tip.width / 2 };
        case "right":
            return { top: anchor.top + anchor.height / 2 - tip.height / 2, left: anchor.right + GAP };
        case "left":
            return { top: anchor.top + anchor.height / 2 - tip.height / 2, left: anchor.left - GAP - tip.width };
        case "bottom":
        default:
            return { top: anchor.bottom + GAP, left: anchor.left + anchor.width / 2 - tip.width / 2 };
    }
};

// Portals into document.body: in-flow bleed inside a scrolling ancestor such as the dock would become horizontal scroll.
// Other props and the ref go to the wrapped trigger, so a Tooltip can itself be another component's trigger.
const triggerPropsFor = (child, extraProps, ref) => {
    const given = Object.fromEntries(Object.entries(extraProps).filter(([, value]) => value !== undefined));
    const merged = { ...given, ...(ref ? { ref } : {}) };
    Object.keys(given).forEach((key) => {
        const own = child.props[key];
        if (/^on[A-Z]/.test(key) && typeof own === "function") {
            merged[key] = (event) => {
                own(event);
                given[key](event);
            };
        }
    });
    return merged;
};

const Tooltip = forwardRef(({ label, shortcut, side = "bottom", children, ...extraProps }, ref) => {
    const [visible, setVisible] = useState(false);
    const [style, setStyle] = useState(null);
    const wrapperRef = useRef(null);
    const tooltipRef = useRef(null);
    const id = useId();

    useLayoutEffect(() => {
        if (!visible) return;
        const anchor = wrapperRef.current?.getBoundingClientRect();
        const tip = tooltipRef.current?.getBoundingClientRect();
        if (!anchor || !tip) return;
        setStyle(placementFor(side, anchor, tip));
    }, [visible, side]);

    useLayoutEffect(() => {
        if (!visible) setStyle(null);
    }, [visible]);

    if (!label) return cloneElement(children, triggerPropsFor(children, extraProps, ref));

    return (
        <span
            ref={wrapperRef}
            className={styles.wrapper}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            onFocus={() => setVisible(true)}
            onBlur={() => setVisible(false)}
        >
            {cloneElement(children, { ...triggerPropsFor(children, extraProps, ref), "aria-describedby": id })}
            {visible &&
                typeof document !== "undefined" &&
                createPortal(
                    <span
                        ref={tooltipRef}
                        role="tooltip"
                        id={id}
                        className={cx(styles.tooltip, { [styles.measuring]: !style })}
                        style={style ? { top: style.top, left: style.left } : undefined}
                    >
                        {label}
                        {shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
                    </span>,
                    document.body,
                )}
        </span>
    );
});

Tooltip.displayName = "Tooltip";

export default Tooltip;
