import cx from "clsx";
import styles from "./BackgroundPicker.module.css";
import { BACKGROUND_TYPES, SOLID_BACKGROUND_TOKENS } from "../rendering/backgroundRenderer";

const TYPE_LABELS = {
    blank: "Blank",
    dot: "Dot grid",
    square: "Square grid",
    lined: "Lined",
    isometric: "Isometric",
    solid: "Solid",
};

const TOKEN_SWATCH_CLASS = {
    "bg-canvas": styles.swatchBgCanvas,
    "bg-sunken": styles.swatchBgSunken,
    "bg-surface": styles.swatchBgSurface,
    "accent-muted": styles.swatchAccentMuted,
};

const TOKEN_LABELS = {
    "bg-canvas": "Canvas",
    "bg-sunken": "Sunken",
    "bg-surface": "Surface",
    "accent-muted": "Accent",
};

// The board's background pattern or colour, shared with everyone through onChange.
const BackgroundPicker = ({ isOpen, onToggle, background, onChange }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.panel} data-board-chrome>
            <div className={styles.panelHeader}>
                <span>Background</span>
                <button className={styles.closeButton} onClick={onToggle} aria-label="Close background picker">
                    ×
                </button>
            </div>
            <div className={styles.typeGrid}>
                {BACKGROUND_TYPES.map((type) => (
                    <button
                        key={type}
                        className={cx(styles.typeButton, { [styles.active]: background.type === type })}
                        onClick={() =>
                            onChange({
                                type,
                                colorToken: type === "solid" ? background.colorToken || SOLID_BACKGROUND_TOKENS[0] : null,
                            })
                        }
                    >
                        {TYPE_LABELS[type]}
                    </button>
                ))}
            </div>
            {background.type === "solid" && (
                <div className={styles.swatchRow}>
                    {SOLID_BACKGROUND_TOKENS.map((token) => (
                        <button
                            key={token}
                            className={cx(styles.swatch, TOKEN_SWATCH_CLASS[token], {
                                [styles.active]: background.colorToken === token,
                            })}
                            onClick={() => onChange({ type: "solid", colorToken: token })}
                            title={TOKEN_LABELS[token]}
                            aria-label={TOKEN_LABELS[token]}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BackgroundPicker;
