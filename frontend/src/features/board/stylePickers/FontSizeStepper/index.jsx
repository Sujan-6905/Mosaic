import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import cx from "clsx";
import styles from "./index.module.css";
import { MIN_FONT_SIZE, MAX_FONT_SIZE } from "../../tools/toolSettings";

const clamp = (value) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));

// The step buttons prevent mousedown so pressing them never blurs a text element's inline editor.
const FontSizeStepper = ({ value, onChange, size = "md" }) => {
    const [draft, setDraft] = useState(String(value));

    useEffect(() => {
        setDraft(String(value));
    }, [value]);

    const commit = (next) => {
        if (!Number.isFinite(next)) {
            setDraft(String(value));
            return;
        }
        const clamped = clamp(Math.round(next));
        onChange(clamped);
        setDraft(String(clamped));
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            commit(value + 1);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            commit(value - 1);
        }
    };

    return (
        <div className={cx(styles.stepper, styles[size])}>
            <button
                type="button"
                className={styles.stepButton}
                aria-label="Decrease font size"
                disabled={value <= MIN_FONT_SIZE}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(value - 1)}
            >
                <FontAwesomeIcon icon={faMinus} />
            </button>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={styles.input}
                value={draft}
                aria-label="Font size"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => commit(draft === "" ? value : parseInt(draft, 10))}
                onKeyDown={handleKeyDown}
            />
            <button
                type="button"
                className={styles.stepButton}
                aria-label="Increase font size"
                disabled={value >= MAX_FONT_SIZE}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(value + 1)}
            >
                <FontAwesomeIcon icon={faPlus} />
            </button>
        </div>
    );
};

export default FontSizeStepper;
