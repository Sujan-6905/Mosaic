import { useEffect, useState } from "react";
import {
    AlignLeft,
    Check,
    Copy,
    DesignNib,
    DragHandGesture,
    EditPencil,
    Erase,
    Expand,
    Eye,
    Frame,
    Group,
    Link,
    Lock,
    MapPin,
    Palette,
    Plus,
    RefreshDouble,
    Sparks,
    Trash,
    WarningTriangle,
} from "iconoir-react";
import { Button } from "@/components/vendor/beautifulUi/atoms/Button";
import { describeDiffCounts, diffForAcceptedOps } from "./editReview";

const iconProps = { width: 14, height: 14, strokeWidth: 1.8, "aria-hidden": true };

// Each kind of change gets the icon a person would look for; a recolour shows the colour itself.
const OP_ICONS = {
    add: Plus,
    delete: Trash,
    connect: Link,
    disconnect: Erase,
    setText: EditPencil,
    restyle: Palette,
    align: AlignLeft,
    distribute: AlignLeft,
    tidy: Sparks,
    cleanUp: Sparks,
    place: DragHandGesture,
    move: DragHandGesture,
    reorder: DragHandGesture,
    moveToFrame: DragHandGesture,
    resize: Expand,
    resizeToFit: Expand,
    rotate: RefreshDouble,
    duplicate: Copy,
    group: Group,
    ungroup: Group,
    frame: Frame,
    lock: Lock,
    drawParts: DesignNib,
};

const OpMark = ({ entry }) => {
    if (entry.swatch) return <span className="size-4 shrink-0 rounded-full shadow-hairline" style={{ background: entry.swatch }} aria-hidden="true" />;
    const Icon = OP_ICONS[entry.op] ?? Sparks;
    return <Icon {...iconProps} className={`shrink-0 ${entry.op === "delete" ? "text-red" : "text-ink-3"}`} />;
};

const Notice = ({ tone = "ink", children }) => (
    <p className={`flex items-start gap-1.5 px-3 pb-2 text-[12px] leading-snug ${tone === "red" ? "text-red" : "text-ink-3"}`}>
        {tone === "red" && <WarningTriangle {...iconProps} className="mt-px shrink-0" />}
        <span>{children}</span>
    </p>
);

// A proposal laid out for review: each change can be ticked, found on the board
// and compared against the board as it is now, and nothing applies until asked.
export default function EditReviewCard({ proposal, onChange, onFocusElements, onShowElements, onCompare, onApply, onDiscard, onUpdate }) {
    const { opsPreview, diff, accepted, autoRepairs, skippedOps, lints, tainted, stale, notice, busy } = proposal;
    const [comparing, setComparing] = useState(false);

    useEffect(() => {
        onCompare(comparing);
    }, [comparing, onCompare]);

    useEffect(() => {
        if (!comparing) return undefined;
        const stop = () => setComparing(false);
        window.addEventListener("pointerup", stop);
        window.addEventListener("blur", stop);
        return () => {
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("blur", stop);
        };
    }, [comparing]);

    const toggle = (index) => onChange(accepted.includes(index) ? accepted.filter((candidate) => candidate !== index) : [...accepted, index]);
    const counts = describeDiffCounts(diffForAcceptedOps(diff, opsPreview, accepted));
    const deleteCount = opsPreview.filter((entry) => entry.op === "delete").length;

    return (
        <section
            aria-label="Review this edit"
            className="mt-3 w-full overflow-hidden rounded-card bg-surface shadow-card"
            onPointerLeave={() => onFocusElements(null)}
        >
            <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <h3 className="text-[13px] font-medium text-ink">Review this edit</h3>
                <p className="min-w-0 flex-1 truncate text-[12px] text-ink-3" aria-live="polite">
                    {counts || "Nothing ticked"}
                </p>
                <button
                    type="button"
                    aria-label="Show all on the board"
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-hover hover:text-ink"
                    onClick={() => onShowElements(null)}
                >
                    <MapPin {...iconProps} />
                </button>
            </header>

            <div className="pt-2">
                {tainted && <Notice tone="red">This came from a turn that used board text the safety check flagged. Check it closely before applying.</Notice>}
                {deleteCount > 0 && (
                    <Notice tone="red">
                        {deleteCount === 1 ? "A delete is" : "Deletes are"} left unticked until you choose to include {deleteCount === 1 ? "it" : "them"}.
                    </Notice>
                )}
            </div>

            <ul className="flex flex-col px-1.5 pb-1.5">
                {opsPreview.map((entry) => {
                    const checked = accepted.includes(entry.index);
                    return (
                        <li
                            key={entry.index}
                            className="group flex items-center rounded-xl hover:bg-hover"
                            onPointerEnter={() => onFocusElements(entry.elementIds)}
                        >
                            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2">
                                <input
                                    type="checkbox"
                                    className="size-4 shrink-0 accent-[var(--color-brand-fill)]"
                                    checked={checked}
                                    onChange={() => toggle(entry.index)}
                                />
                                <OpMark entry={entry} />
                                <span
                                    className={`min-w-0 text-[13px] leading-snug ${entry.op === "delete" ? "text-red" : "text-ink"} ${checked ? "" : "opacity-55"}`}
                                >
                                    {entry.summary}
                                </span>
                            </label>
                            {entry.elementIds?.length > 0 && (
                                <button
                                    type="button"
                                    aria-label={`Show on the board: ${entry.summary}`}
                                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
                                    onClick={() => onShowElements(entry.elementIds)}
                                >
                                    <MapPin {...iconProps} />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {autoRepairs?.length > 0 && <Notice>It also tidied the layout so nothing overlaps.</Notice>}
            {skippedOps?.length > 0 && <Notice>Left out, as it isn&apos;t possible: {skippedOps.join("; ")}.</Notice>}
            {lints?.length > 0 && <Notice>Heads up: {lints.map((lint) => lint.notice ?? lint.message).join("; ")}.</Notice>}

            {stale && (
                <div className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-hover-2 p-2.5">
                    <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{notice || "The board changed under this proposal."}</p>
                    <Button variant="primary" size="sm" className="min-h-11" disabled={busy} onClick={onUpdate}>
                        <RefreshDouble {...iconProps} />
                        Update proposal
                    </Button>
                </div>
            )}
            {!stale && notice && <Notice tone="red">{notice}</Notice>}

            <footer className="primitive-card-footer flex items-center gap-1.5">
                <Button variant="primary" size="sm" className="min-h-11" disabled={busy || accepted.length === 0 || stale} onClick={() => onApply(accepted)}>
                    <Check {...iconProps} />
                    Apply
                </Button>
                <Button variant="quiet" size="sm" className="min-h-11" disabled={busy} onClick={onDiscard}>
                    Discard
                </Button>
                <span className="flex-1" />
                <Button
                    variant="quiet"
                    size="sm"
                    className="min-h-11 touch-none whitespace-nowrap"
                    aria-label="Hold to see the board before this edit"
                    aria-pressed={comparing}
                    onPointerDown={() => setComparing(true)}
                >
                    <Eye {...iconProps} />
                    Hold to compare
                </Button>
            </footer>
        </section>
    );
}
