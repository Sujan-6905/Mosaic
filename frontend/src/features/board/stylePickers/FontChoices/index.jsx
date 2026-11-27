import { useEffect, useMemo } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { loadFontSource } from "../../rendering/fontLoader";
import { fontChoiceGroups, isCurrentChoice } from "./fontChoices";
import styles from "./index.module.css";

// Every font the board can use, grouped, each shown in its own face. Inside
// the text editor `keepFocus` stops a pick from blurring the text being edited.
export default function FontChoiceList({ current, onPick, keepFocus = false }) {
    const groups = useMemo(() => fontChoiceGroups(current), [current]);

    useEffect(() => {
        groups.forEach((group) => group.choices.forEach((font) => font.source && loadFontSource(font.family, font.source).catch(() => {})));
    }, [groups]);

    return (
        <div className={styles.list} role="radiogroup" aria-label="Font">
            {groups.map((group) => (
                <div key={group.label} className={styles.group}>
                    <p className={styles.groupLabel}>{group.label}</p>
                    {group.choices.map((font) => {
                        const selected = isCurrentChoice(font, current);
                        return (
                            <button
                                key={font.source?.url || font.fontFamily}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                style={{ fontFamily: font.fontFamily }}
                                onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
                                onClick={() => onPick(font)}
                            >
                                {font.family}
                                {selected && <StrokeIcon name="check" size={14} strokeWidth={2.4} />}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
