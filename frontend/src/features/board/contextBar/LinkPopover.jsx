import { useState } from "react";
import Popover from "@/components/ui/Popover";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { isSafeLink, normalizeLink } from "../../../../../shared/canvas/elements/links.js";
import { BarButton } from "./popovers";
import styles from "./index.module.css";
import controls from "./controls.module.css";

// Adds, changes, opens or removes the link on the selection.
export default function LinkPopover({ link, onChange }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(link || "");
    const [problem, setProblem] = useState(null);

    const save = (event) => {
        event.preventDefault();
        if (!draft.trim()) {
            onChange(null);
            setOpen(false);
            return;
        }
        const normalized = normalizeLink(draft);
        if (!normalized) {
            setProblem("Enter a web address, like mosaic.app or https://mosaic.app");
            return;
        }
        onChange(normalized);
        setProblem(null);
        setOpen(false);
    };

    return (
        <Popover
            align="start"
            isOpen={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) {
                    setDraft(link || "");
                    setProblem(null);
                }
            }}
            trigger={
                <BarButton label={link ? `Link: ${link}` : "Add a link"} pressed={Boolean(link)}>
                    <StrokeIcon name="link" size={15} />
                </BarButton>
            }
        >
            <form className={`${styles.pop} ${controls.linkPop}`} onSubmit={save} onKeyDown={(event) => event.stopPropagation()}>
                <label className={styles.sliderHead} htmlFor="element-link">
                    Link
                </label>
                <input
                    id="element-link"
                    className={controls.linkInput}
                    autoFocus
                    placeholder="https://"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                />
                {problem && (
                    <p role="alert" className={controls.linkProblem}>
                        {problem}
                    </p>
                )}
                <div className={controls.linkActions}>
                    {link && (
                        <>
                            {isSafeLink(link) && (
                                <a className={controls.linkOpen} href={link} target="_blank" rel="noopener noreferrer">
                                    Open
                                </a>
                            )}
                            <button
                                type="button"
                                className={controls.linkRemove}
                                onClick={() => {
                                    onChange(null);
                                    setOpen(false);
                                }}
                            >
                                Remove
                            </button>
                        </>
                    )}
                    <button type="submit" className={controls.linkSave}>
                        Save
                    </button>
                </div>
            </form>
        </Popover>
    );
}
