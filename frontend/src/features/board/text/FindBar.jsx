import { useEffect, useRef } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { FIND_INPUT_ID } from "./boardFind";
import styles from "./FindBar.module.css";

const matchLabel = (query, index, count) => {
    if (!query.trim()) return "";
    if (count === 0) return "No matches";
    return `${index + 1} of ${count}`;
};

const FindBar = ({ isOpen, query, onQueryChange, index, count, onStep, onClose, belowWorkshop }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) inputRef.current?.select();
    }, [isOpen]);

    if (!isOpen) return null;

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        } else if (e.key === "Enter") {
            e.preventDefault();
            onStep(e.shiftKey ? -1 : 1);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
            e.preventDefault();
            inputRef.current?.select();
        }
    };

    return (
        <div className={styles.find} role="search" aria-label="Find on board" data-board-chrome data-below-workshop={belowWorkshop || undefined}>
            <StrokeIcon name="search" size={15} className={styles.icon} />
            <input
                ref={inputRef}
                id={FIND_INPUT_ID}
                className={styles.input}
                type="search"
                value={query}
                placeholder="Find text on this board"
                aria-label="Find text on this board"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <span className={styles.count} aria-live="polite">
                {matchLabel(query, index, count)}
            </span>
            <button
                type="button"
                className={styles.button}
                onClick={() => onStep(-1)}
                disabled={count === 0}
                aria-label="Previous match"
                title="Previous (Shift+Enter)"
            >
                <StrokeIcon name="chevronUp" size={15} strokeWidth={2.2} />
            </button>
            <button type="button" className={styles.button} onClick={() => onStep(1)} disabled={count === 0} aria-label="Next match" title="Next (Enter)">
                <StrokeIcon name="chevronDown" size={15} strokeWidth={2.2} />
            </button>
            <button type="button" className={styles.button} onClick={onClose} aria-label="Close find" title="Close (Esc)">
                <StrokeIcon name="close" size={14} strokeWidth={2.2} />
            </button>
        </div>
    );
};

export default FindBar;
