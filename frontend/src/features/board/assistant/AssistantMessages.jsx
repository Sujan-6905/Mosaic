import { useState } from "react";
import { Copy, EditPencil, Check, Undo } from "iconoir-react";
import ApprovalCard from "@/components/vendor/beautifulUi/primitives/ApprovalCard";
import StreamingText from "@/components/vendor/beautifulUi/primitives/StreamingText";
import ThinkingState from "@/components/vendor/beautifulUi/primitives/ThinkingState";
import { Button } from "@/components/vendor/beautifulUi/atoms/Button";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview.jsx";
import EditReviewCard from "./EditReviewCard";
import DiagramStyleCard from "./DiagramStyleCard";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";

const iconProps = { width: 14, height: 14, strokeWidth: 1.8, "aria-hidden": true };

const useCopy = (text) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return [copied, copy];
};

const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

// Drawn at twice the card's width for a crisp downscale, with the height
// following the diagram's own shape so a tall flow isn't cropped to fit.
const PREVIEW_WIDTH = 680;
const previewHeightFor = (elements) => {
    const bounds = getUnionBounds(Object.values(elements));
    if (!bounds) return 360;
    const aspect = (bounds.maxY - bounds.minY) / Math.max(1, bounds.maxX - bounds.minX);
    return Math.round(Math.min(Math.max(PREVIEW_WIDTH * aspect, 320), 760));
};

export function UserMessage({ text, onEdit, canEdit }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(text);
    const [copied, copy] = useCopy(text);

    if (editing) {
        const submit = () => {
            const next = draft.trim();
            setEditing(false);
            if (next) onEdit(next);
        };
        return (
            <div className="flex justify-end pl-6" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
                <div className="w-full rounded-xl bg-field p-2 shadow-hairline">
                    <textarea
                        autoFocus
                        value={draft}
                        rows={3}
                        aria-label="Edit message"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                submit();
                            }
                            if (event.key === "Escape") {
                                event.stopPropagation();
                                setEditing(false);
                                setDraft(text);
                            }
                        }}
                        className="w-full resize-none bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-ink outline-none"
                    />
                    <div className="mt-1 flex justify-end gap-1.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setEditing(false);
                                setDraft(text);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" disabled={!draft.trim()} onClick={submit}>
                            Send
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group/user flex flex-col items-end pl-10" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
            <div className="rounded-xl bg-field px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink shadow-hairline [overflow-wrap:anywhere]">
                {text}
            </div>
            <div className="mt-1 flex gap-0.5 opacity-0 transition-opacity duration-150 group-hover/user:opacity-100 focus-within:opacity-100">
                <button
                    type="button"
                    aria-label={copied ? "Copied" : "Copy message"}
                    title={copied ? "Copied" : "Copy"}
                    onClick={copy}
                    className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
                >
                    {copied ? <Check {...iconProps} /> : <Copy {...iconProps} />}
                </button>
                {canEdit && (
                    <button
                        type="button"
                        aria-label="Edit and resend"
                        title="Edit and resend"
                        onClick={() => setEditing(true)}
                        className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
                    >
                        <EditPencil {...iconProps} />
                    </button>
                )}
            </div>
        </div>
    );
}

function DiagramCard({ elements, summary, insertLabel, canEdit, inserted, onInsert, onDiscard }) {
    return (
        <div
            className="mt-3 w-full overflow-hidden rounded-card bg-surface shadow-card"
            style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}
        >
            <div className="border-b border-line bg-inset">
                <StaticCanvasPreview
                    elements={elements}
                    background={{ type: "blank", colorToken: null }}
                    width={PREVIEW_WIDTH}
                    height={previewHeightFor(elements)}
                    className="block h-auto w-full"
                />
            </div>
            <div className="primitive-card-footer flex items-center justify-between gap-3">
                <span className="pl-1 text-[12px] text-ink-3">{summary}</span>
                {inserted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-tint py-1 pr-2.5 pl-1 text-[12.5px] font-medium text-green">
                        <span className="flex size-4.5 items-center justify-center rounded-full bg-green text-white">
                            <Check width={11} height={11} strokeWidth={3} aria-hidden />
                        </span>
                        Added to the board
                    </span>
                ) : canEdit ? (
                    <div className="flex items-center gap-1.5">
                        {onDiscard && (
                            <Button variant="ghost" size="sm" onClick={onDiscard}>
                                Discard
                            </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={onInsert}>
                            {insertLabel}
                        </Button>
                    </div>
                ) : (
                    <span className="text-[12px] text-ink-3">You need edit access to add this.</span>
                )}
            </div>
        </div>
    );
}

function ResolvedPill({ tone = "ink", children }) {
    return (
        <span
            className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${tone === "green" ? "bg-green-tint text-green" : "bg-hover-2 text-ink-2"}`}
        >
            {children}
        </span>
    );
}

// `live` holds what only this session knows about the turn (pending preview, reply to stream, agent trace);
// a message loaded from history renders settled.
export function AssistantMessage({
    message,
    live,
    canEdit,
    isLast,
    onRetry,
    onOpenHelp,
    review,
    onRevertEdit,
    onStreamDone,
    onFocusCandidate,
    onChooseCandidate,
    onCancelChoice,
    onRefine,
    diagramElements,
    onInsertDiagram,
    onDiscardDiagram,
    onChooseStyle,
}) {
    const [copied, copy] = useCopy(message.content);
    const sketchPartCount = message.parts?.length ?? message.strokes?.length;
    const summary = sketchPartCount
        ? `${sketchPartCount} part${sketchPartCount === 1 ? "" : "s"}`
        : `${message.nodes?.length ?? 0} node${message.nodes?.length === 1 ? "" : "s"}`;
    const actions = [
        { key: "copy", label: copied ? "Copied" : "Copy", glyph: copied ? "copied" : "copy", onClick: copy },
        ...(isLast && onRetry ? [{ key: "retry", label: "Retry", glyph: "retry", onClick: onRetry }] : []),
    ];

    return (
        <article className="min-w-0" style={{ animation: "fade-up 450ms cubic-bezier(0.23,1,0.32,1) both" }}>
            {live?.trace && live.trace.rows.length > 0 && (
                <div className="mb-2">
                    <ThinkingState rows={live.trace.rows} working={false} active="Working" done={`Worked for ${formatSeconds(live.trace.elapsedMs)}`} />
                </div>
            )}

            <StreamingText
                text={message.content}
                instant={!live?.fresh || live?.streamed}
                onDone={live?.fresh && !live?.streamed ? onStreamDone : undefined}
                tone={message.failed ? "red" : "ink"}
                actions={actions}
            />
            {message.failed && message.traceId && <p className="mt-1.5 text-[11px] text-ink-3">Reference {message.traceId.slice(0, 8)}</p>}

            {message.help && onOpenHelp && (
                <button
                    type="button"
                    onClick={onOpenHelp}
                    className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-hover-2 px-3.5 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-hover"
                >
                    Open Help and resources
                </button>
            )}

            {message.proposal && live?.previewOpen && review && <EditReviewCard {...review} />}
            {message.proposal && live?.resolution === "discarded" && <ResolvedPill>Discarded</ResolvedPill>}
            {message.proposal && !live?.previewOpen && !live?.resolution && <ResolvedPill>No longer open</ResolvedPill>}

            {message.batchId && canEdit && (
                <div className="mt-2">
                    {message.revertedAt ? (
                        <ResolvedPill>Undone</ResolvedPill>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onRevertEdit(message.batchId)}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-hover-2 px-3.5 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-hover"
                        >
                            <Undo {...iconProps} />
                            Undo this edit
                        </button>
                    )}
                </div>
            )}

            {message.ambiguous && live?.choiceOpen && (
                <div className="mt-3">
                    <ApprovalCard
                        questions={[{ q: "Which one do you mean?", type: "radio", options: message.candidates.map((c, i) => `${i + 1}. ${c.name}`) }]}
                        labels={{ send: "Choose", skip: "Cancel", sentMessage: "Got it", customPlaceholder: "Describe it differently…" }}
                        resettable={false}
                        onAnswerChange={(_, picked) => onFocusCandidate(message.candidates[picked[0]]?.ref ?? null)}
                        onSubmitted={(answers, custom) => {
                            if (custom[0]?.trim()) onRefine(custom[0].trim());
                            else onChooseCandidate(message.candidates[answers[0][0]].ref);
                        }}
                        onSkip={onCancelChoice}
                    />
                </div>
            )}

            {diagramElements && message.style && !live?.inserted && canEdit && (
                <DiagramStyleCard message={message} chosen={live?.chosenStyle ?? null} onChoose={onChooseStyle} />
            )}
            {diagramElements && (
                <DiagramCard
                    elements={diagramElements}
                    summary={summary}
                    insertLabel={message.replaces?.length > 0 ? "Replace on board" : "Place on board"}
                    canEdit={canEdit}
                    inserted={live?.inserted}
                    onInsert={onInsertDiagram}
                    onDiscard={live?.fresh ? onDiscardDiagram : null}
                />
            )}
        </article>
    );
}

export function PendingTurn({ pending }) {
    return <ThinkingState rows={pending.rows} working active="Working on it" done="Done" />;
}
