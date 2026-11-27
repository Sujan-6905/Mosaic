import { useEffect, useRef, useState } from "react";
import { isSafeLink } from "../../../../../shared/canvas/elements/links.js";
import { worldToScreen } from "../camera/camera";
import { getCachedElementBounds } from "../rendering/boundsCache";
import styles from "./BoardInlineCards.module.css";

const hostOf = (link) => {
    try {
        const url = new URL(link);
        return url.protocol === "mailto:" ? link.replace("mailto:", "") : url.hostname.replace(/^www\./, "");
    } catch {
        return link;
    }
};

// Where a linked element goes and a way to get there.
export const LinkHoverCard = ({ element, camera }) => {
    const bounds = getCachedElementBounds(element);
    if (!bounds || !isSafeLink(element.link)) return null;
    const screen = worldToScreen(camera, bounds.maxX, bounds.minY);
    return (
        <a
            className={styles.linkCard}
            data-board-chrome
            href={element.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ left: screen.x, top: screen.y }}
        >
            <span className={styles.linkHost}>{hostOf(element.link)}</span>
            <span aria-hidden="true" className={styles.linkArrow}>
                Open
            </span>
        </a>
    );
};

export const FrameRenameInput = ({ frame, camera, onCommit }) => {
    const [name, setName] = useState(frame.name || "");
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    const bounds = getCachedElementBounds(frame);
    if (!bounds) return null;
    const screen = worldToScreen(camera, bounds.minX, bounds.minY);
    return (
        <input
            ref={inputRef}
            aria-label="Frame name"
            data-board-chrome
            className={styles.frameName}
            style={{ left: screen.x, top: screen.y }}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onCommit(name.trim())}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onCommit(name.trim());
                if (e.key === "Escape") onCommit(frame.name);
            }}
        />
    );
};
