import { useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { swatchColorValue } from "../rendering/colorResolver";
import { PALETTE } from "./popovers";
import FontPopover from "./FontPopover";
import { STROKE_PRESETS } from "./StyleControls";
import styles from "./index.module.css";

const ELEMENT_NAMES = { sticky: "Sticky note", text: "Text", shape: "Shape", path: "Stroke", connector: "Connector", frame: "Frame", image: "Image" };
const TEXT_SIZES = [
    { label: "S", size: 14 },
    { label: "M", size: 18 },
    { label: "L", size: 24 },
    { label: "XL", size: 36 },
];

// The phone layout: a row of the quick actions above the dock, with the
// styling in a bottom sheet rather than a toolbar a thumb can't reach across.
export default function PhoneSelection({
    primary,
    count,
    targets,
    values,
    isTextual,
    hasStroke,
    size,
    setColour,
    setSize,
    onUpdate,
    act,
    locked,
    aiEnabled,
    onAskAi,
    onUndo,
    onRedo,
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const target = targets[0];
    const sizes = isTextual ? TEXT_SIZES : STROKE_PRESETS.map((preset, index) => ({ label: TEXT_SIZES[index].label, size: preset.size }));

    return (
        <>
            <div role="toolbar" aria-label="Selection" className={styles.phoneRow}>
                <span className={styles.phoneActions}>
                    <button type="button" className={styles.button} aria-label="Undo" onClick={onUndo}>
                        <StrokeIcon name="undo" />
                    </button>
                    <button type="button" className={styles.button} aria-label="Redo" onClick={onRedo}>
                        <StrokeIcon name="redo" />
                    </button>
                    <button type="button" className={styles.button} aria-label="Duplicate selection" onClick={act("duplicate")}>
                        <StrokeIcon name="duplicate" size={16} />
                    </button>
                    <button type="button" className={styles.button} aria-label="Delete selection" onClick={act("remove")}>
                        <StrokeIcon name="trash" size={16} />
                    </button>
                </span>
                <button type="button" className={styles.styleButton} aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
                    {target && (
                        <span
                            className={styles.swatchPreview}
                            style={values[target.field] ? { background: swatchColorValue(values[target.field]) } : undefined}
                        />
                    )}
                    Style
                </button>
            </div>
            {sheetOpen && (
                <>
                    <button type="button" className={styles.scrim} aria-label="Close style sheet" onClick={() => setSheetOpen(false)} />
                    <div role="dialog" aria-label="Style" className={styles.sheet}>
                        <span className={styles.grabber} aria-hidden="true" />
                        <div className={styles.sheetHead}>
                            <strong>{count > 1 ? `${count} elements` : ELEMENT_NAMES[primary.type] || "Selection"}</strong>
                            <button type="button" onClick={() => setSheetOpen(false)}>
                                Done
                            </button>
                        </div>
                        {target && (
                            <div className={styles.sheetSwatches} role="radiogroup" aria-label={target.label}>
                                {PALETTE.slice(0, 7).map((colour) => (
                                    <button
                                        key={colour}
                                        type="button"
                                        role="radio"
                                        aria-checked={values[target.field] === colour}
                                        aria-label={colour}
                                        className={styles.swatch}
                                        style={{ background: swatchColorValue(colour) }}
                                        onClick={() => setColour(target.field, colour)}
                                    />
                                ))}
                            </div>
                        )}
                        {(isTextual || hasStroke) && (
                            <div className={styles.tabs} role="group" aria-label={isTextual ? "Text size" : "Stroke width"}>
                                {sizes.map((option) => (
                                    <button
                                        key={option.label}
                                        type="button"
                                        aria-pressed={size === option.size}
                                        onClick={() => (isTextual ? onUpdate({ size: option.size }) : setSize(option.size))}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {isTextual && <FontPopover element={primary} onUpdate={onUpdate} />}
                        <div className={styles.sheetActions}>
                            <button type="button" onClick={act("bringToFront")}>
                                Bring to front
                            </button>
                            <button type="button" onClick={act("sendToBack")}>
                                Send to back
                            </button>
                            <button type="button" onClick={act("toggleLock")}>
                                {locked ? "Unlock" : "Lock"}
                            </button>
                            {(count >= 2 || primary.diagram) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSheetOpen(false);
                                        act("openRestyle")();
                                    }}
                                >
                                    Restyle
                                </button>
                            )}
                            {aiEnabled && (
                                <button type="button" onClick={onAskAi}>
                                    Ask AI
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
