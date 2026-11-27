import { useState } from "react";
import Popover from "@/components/ui/Popover";
import Slider from "@/components/ui/Slider";
import Tooltip from "@/components/ui/Tooltip";
import ColorPicker from "../stylePickers/ColorPicker";
import FontSizeStepper from "../stylePickers/FontSizeStepper";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { swatchColorValue } from "../rendering/colorResolver";
import { COLOR_ARRAY, FONT_SIZE_PRESETS } from "../tools/toolSettings";
import styles from "./index.module.css";

export const PALETTE = COLOR_ARRAY.slice(0, 15);

export function BarButton({ label, pressed, children, wide, ...rest }) {
    return (
        <Tooltip label={label} side="top">
            <button type="button" className={wide ? `${styles.button} ${styles.wide}` : styles.button} aria-label={label} aria-pressed={pressed} {...rest}>
                {children}
            </button>
        </Tooltip>
    );
}

export function ColourPopover({ targets, values, opacity, onColour, onOpacity }) {
    const [targetId, setTargetId] = useState(targets[0].id);
    const target = targets.find((candidate) => candidate.id === targetId) || targets[0];
    const value = values[target.field];
    const preview = values[targets[0].field];

    return (
        <Popover
            align="start"
            trigger={
                <BarButton label={`Colour: ${target.label}`} wide>
                    <span
                        className={styles.swatchPreview}
                        data-none={preview == null}
                        style={preview ? { background: swatchColorValue(preview) } : undefined}
                    />
                    <StrokeIcon name="chevronDown" size={10} strokeWidth={3} />
                </BarButton>
            }
        >
            <div className={styles.pop}>
                {targets.length > 1 && (
                    <div role="tablist" aria-label="Colour target" className={styles.tabs}>
                        {targets.map((candidate) => (
                            <button
                                key={candidate.id}
                                type="button"
                                role="tab"
                                aria-selected={candidate.id === target.id}
                                onClick={() => setTargetId(candidate.id)}
                            >
                                {candidate.label}
                            </button>
                        ))}
                    </div>
                )}
                <div className={styles.palette} role="radiogroup" aria-label="Palette">
                    {target.none && (
                        <button
                            type="button"
                            role="radio"
                            aria-checked={value == null}
                            aria-label="No fill"
                            className={`${styles.swatch} ${styles.noneSwatch}`}
                            onClick={() => onColour(target.field, null)}
                        />
                    )}
                    {PALETTE.map((colour) => (
                        <button
                            key={colour}
                            type="button"
                            role="radio"
                            aria-checked={value === colour}
                            aria-label={colour}
                            className={styles.swatch}
                            style={{ background: swatchColorValue(colour) }}
                            onClick={() => onColour(target.field, colour)}
                        />
                    ))}
                </div>
                <ColorPicker value={value} onChange={(colour, options) => onColour(target.field, colour, options)} />
                {opacity != null && (
                    <label className={styles.sliderRow}>
                        <span className={styles.sliderHead}>
                            Opacity <span>{opacity}%</span>
                        </span>
                        <Slider
                            value={[opacity]}
                            onValueChange={([next]) => onOpacity(next, { transient: true })}
                            onValueCommit={([next]) => onOpacity(next)}
                            min={1}
                            max={100}
                            aria-label="Opacity"
                        />
                    </label>
                )}
            </div>
        </Popover>
    );
}

// Its own control beside the font: the number is typed or stepped in the bar, and
// the arrow lists the usual sizes.
export function FontSizeControl({ value, onChange }) {
    return (
        <div className={styles.sizeControl} role="group" aria-label="Font size">
            <FontSizeStepper size="sm" value={value} onChange={onChange} />
            <Popover
                align="start"
                trigger={
                    <BarButton label="Common font sizes" className={`${styles.button} ${styles.sizeMenuButton}`}>
                        <StrokeIcon name="chevronDown" size={10} strokeWidth={3} />
                    </BarButton>
                }
            >
                <div className={`${styles.pop} ${styles.sizeMenu}`} role="radiogroup" aria-label="Common font sizes">
                    {FONT_SIZE_PRESETS.map((size) => (
                        <button key={size} type="button" role="radio" aria-checked={value === size} onClick={() => onChange(size)}>
                            {size}
                        </button>
                    ))}
                </div>
            </Popover>
        </div>
    );
}

export function MenuPopover({ label, icon, items }) {
    return (
        <Popover
            align="start"
            trigger={
                <BarButton label={label}>
                    <StrokeIcon name={icon} size={16} />
                </BarButton>
            }
        >
            <div className={`${styles.pop} ${styles.menu}`} role="menu" aria-label={label}>
                {items.map((item) =>
                    item.heading ? (
                        <p key={item.heading} className={styles.menuHeading}>
                            {item.heading}
                        </p>
                    ) : (
                        <button
                            key={item.label}
                            type="button"
                            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                            aria-checked={item.checked}
                            disabled={item.disabled}
                            data-danger={item.danger}
                            onClick={item.onSelect}
                        >
                            {item.label}
                            {item.shortcut && <kbd>{item.shortcut}</kbd>}
                            {item.checked && <StrokeIcon name="check" size={14} />}
                        </button>
                    ),
                )}
            </div>
        </Popover>
    );
}
