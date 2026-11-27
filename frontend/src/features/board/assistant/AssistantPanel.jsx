import { ArrowDown, ChatPlusIn, Collapse, Expand, MoreHoriz, SidebarExpand, Sparks, Xmark } from "iconoir-react";
import { AssistantMessage, PendingTurn, UserMessage } from "./AssistantMessages";
import PromptBar from "@/components/vendor/beautifulUi/primitives/PromptBar";
import SidebarNav from "@/components/vendor/beautifulUi/primitives/SidebarNav";
import { Switch } from "@/components/vendor/beautifulUi/atoms/Switch";
import { COMMANDS, HeaderButton, PANEL_EXIT_MS, iconProps, sketchPartsOf, suggestionsFor } from "./assistantHelpers";
import useAssistantSession from "./useAssistantSession";
import { diagramOf, recipeOf } from "../diagrams/diagramStyles";

export default function AssistantPanel(props) {
    const { userName, canEdit, placing, onClose, boardHasContent, onOpenHelp, onShowPreviewElements, onAcceptSketch, onAccept } = props;
    const {
        activeId,
        activeTitle,
        applyPreview,
        autoApply,
        chats,
        chooseCandidate,
        closing,
        composerHeight,
        composerRef,
        contentRef,
        diagramElements,
        disambiguation,
        discardPreview,
        empty,
        expanded,
        historyOpen,
        lastUserIndex,
        live,
        messages,
        openChat,
        patchLive,
        patchPreview,
        pending,
        pinned,
        preview,
        recents,
        retry,
        revertEdit,
        scrollRef,
        selection,
        send,
        setAutoApplyPreference,
        setDisambiguation,
        setExpanded,
        setHistoryOpen,
        setIgnoreSelection,
        setPreviewComparing,
        setPreviewFocus,
        setSettingsOpen,
        settingsOpen,
        settingsRef,
        startNewChat,
        stop,
        updatePreview,
        mounted,
    } = useAssistantSession(props);

    if (!props.aiEnabled || !mounted) return null;

    const firstName = (userName || "").split(/\s+/)[0];
    const selectionCount = selection.length;
    const context =
        selectionCount > 0
            ? [{ key: "selection", label: `${selectionCount} selected object${selectionCount === 1 ? "" : "s"}`, onRemove: () => setIgnoreSelection(true) }]
            : [];

    const composer = (
        <PromptBar
            tall={empty}
            placeholder={disambiguation ? "Type a number, or describe it…" : "Ask about the board, or describe what to draw or change…"}
            onSend={(text) => send(text)}
            commands={COMMANDS}
            menuBoundsRef={scrollRef}
            context={context}
            busy={Boolean(pending)}
            onStop={stop}
            disabled={!canEdit}
            autoFocus
        />
    );

    const sidebar = (
        <SidebarNav
            fill
            title="Assistant"
            activeId={activeId}
            recents={recents}
            onNewChat={startNewChat}
            onPick={openChat}
            onRename={chats.rename}
            onDelete={chats.remove}
            onCollapse={historyOpen ? () => setHistoryOpen(false) : undefined}
        />
    );

    return (
        <div
            role="dialog"
            aria-label="AI assistant"
            data-board-chrome
            onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                if (historyOpen) setHistoryOpen(false);
                else if (settingsOpen) setSettingsOpen(false);
            }}
            className={`bui fixed z-[1960] flex overflow-hidden bg-page shadow-overlay transition-opacity duration-200 max-sm:inset-0 max-sm:z-[2050] sm:rounded-window [@media(max-height:500px)]:!top-2 [@media(max-height:500px)]:!bottom-2 ${placing ? "pointer-events-none opacity-30 max-sm:opacity-0" : ""} ${
                expanded ? "sm:inset-x-4 sm:top-[76px] sm:bottom-[76px]" : "sm:top-[76px] sm:right-4 sm:bottom-[76px] sm:w-[min(26rem,calc(100vw-2rem))]"
            }`}
            style={{
                animation: closing ? `panel-out ${PANEL_EXIT_MS}ms ease-in both` : "pop-in 200ms cubic-bezier(0.23,1,0.32,1) backwards",
                transformOrigin: "bottom right",
            }}
        >
            {expanded && <div className="hidden border-r border-line py-2.5 lg:flex">{sidebar}</div>}

            <div className="relative flex min-w-0 flex-1 flex-col">
                <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-2.5">
                    <div className={expanded ? "lg:hidden" : ""}>
                        <HeaderButton label="Chat history" onClick={() => setHistoryOpen((v) => !v)} pressed={historyOpen}>
                            <SidebarExpand {...iconProps} />
                        </HeaderButton>
                    </div>
                    <h2 className="min-w-0 flex-1 truncate px-1 text-[13.5px] font-medium text-ink" title={activeTitle}>
                        {activeTitle}
                    </h2>
                    <HeaderButton label="New chat" onClick={startNewChat}>
                        <ChatPlusIn {...iconProps} />
                    </HeaderButton>
                    <div className="relative" ref={settingsRef}>
                        <HeaderButton label="Assistant settings" onClick={() => setSettingsOpen((v) => !v)} pressed={settingsOpen}>
                            <MoreHoriz {...iconProps} />
                        </HeaderButton>
                        {settingsOpen && (
                            <div
                                className="absolute top-9 right-0 z-20 w-64 rounded-[12px] bg-surface p-3 shadow-overlay"
                                style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top right" }}
                            >
                                <label className="flex items-start justify-between gap-3">
                                    <span>
                                        <span className="block text-[13px] font-medium text-ink">Auto-apply safe edits</span>
                                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">
                                            Skip the review step for small, low-risk changes.
                                        </span>
                                    </span>
                                    <Switch checked={autoApply} onChange={setAutoApplyPreference} label="Auto-apply safe edits" />
                                </label>
                            </div>
                        )}
                    </div>
                    <span className="max-sm:hidden">
                        <HeaderButton label={expanded ? "Dock to the side" : "Expand"} onClick={() => setExpanded((v) => !v)}>
                            {expanded ? <Collapse {...iconProps} /> : <Expand {...iconProps} />}
                        </HeaderButton>
                    </span>
                    <HeaderButton label="Close AI assistant" onClick={onClose}>
                        <Xmark {...iconProps} />
                    </HeaderButton>
                </header>

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <div
                        ref={contentRef}
                        className={`mx-auto flex w-full flex-col gap-7 px-4 pt-6 ${expanded ? "max-w-[720px] sm:px-8" : ""}`}
                        style={{ paddingBottom: empty ? 24 : composerHeight + 24 }}
                    >
                        {empty ? (
                            <div className="flex flex-col pt-6">
                                <h3 className="text-[22px] font-normal tracking-[-0.02em] text-ink">
                                    <span className="block text-ink-3" style={{ animation: "fade-up 500ms cubic-bezier(0.16,1,0.3,1) both" }}>
                                        {firstName ? `Hi ${firstName}` : "Hi there"}
                                    </span>
                                    <span className="block" style={{ animation: "fade-up 500ms cubic-bezier(0.16,1,0.3,1) 120ms both" }}>
                                        What should we make on this board?
                                    </span>
                                </h3>
                                <div
                                    className="relative z-20 mt-6"
                                    ref={composerRef}
                                    data-tour="ai-composer"
                                    style={{ animation: "fade-up 500ms cubic-bezier(0.16,1,0.3,1) 200ms both" }}
                                >
                                    {composer}
                                </div>
                                <div className="mt-5 flex flex-col" style={{ animation: "fade-up 500ms cubic-bezier(0.16,1,0.3,1) 300ms both" }}>
                                    {suggestionsFor({ boardHasContent, selectionCount }).map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            disabled={!canEdit}
                                            onClick={() => send(suggestion)}
                                            className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 text-left text-[13.5px] text-ink transition-colors duration-150 hover:bg-hover disabled:opacity-50"
                                        >
                                            <span className="text-ink-3">
                                                <Sparks {...iconProps} width={15} height={15} />
                                            </span>
                                            <span className="min-w-0 truncate">{suggestion}</span>
                                        </button>
                                    ))}
                                </div>
                                {!canEdit && (
                                    <p className="mt-4 text-[12.5px] text-ink-3">{"You have view access to this board, so the assistant can't change it."}</p>
                                )}
                            </div>
                        ) : (
                            messages.map((message, index) =>
                                message.role === "user" ? (
                                    <UserMessage key={index} text={message.content} canEdit={canEdit && !pending} onEdit={(text) => send(text)} />
                                ) : (
                                    <AssistantMessage
                                        key={`${activeId}-${index}`}
                                        message={message}
                                        live={live[index]}
                                        canEdit={canEdit}
                                        isLast={index === messages.length - 1 && !pending}
                                        onRetry={lastUserIndex >= 0 && canEdit ? retry : null}
                                        onOpenHelp={onOpenHelp}
                                        review={
                                            preview?.messageIndex === index
                                                ? {
                                                      proposal: preview,
                                                      onChange: (accepted) => patchPreview({ accepted }),
                                                      onFocusElements: setPreviewFocus,
                                                      onShowElements: (elementIds) => onShowPreviewElements?.(preview.diff, elementIds),
                                                      onCompare: setPreviewComparing,
                                                      onApply: applyPreview,
                                                      onDiscard: discardPreview,
                                                      onUpdate: updatePreview,
                                                  }
                                                : null
                                        }
                                        onRevertEdit={revertEdit}
                                        onStreamDone={() => patchLive(index, { streamed: true })}
                                        onFocusCandidate={(focusedRef) => setDisambiguation((prev) => (prev ? { ...prev, focusedRef } : prev))}
                                        onChooseCandidate={chooseCandidate}
                                        onCancelChoice={() => {
                                            patchLive(index, { choiceOpen: false });
                                            setDisambiguation(null);
                                        }}
                                        onRefine={(text) => send(text)}
                                        diagramElements={diagramElements[index]}
                                        onInsertDiagram={() => {
                                            const onPlaced = () => patchLive(index, { inserted: true });
                                            const parts = sketchPartsOf(message);
                                            if (parts) onAcceptSketch?.(parts, { onPlaced, title: message.title });
                                            else
                                                onAccept?.(diagramOf(message), {
                                                    recipe: recipeOf(live[index]?.chosenStyle ?? message.style),
                                                    replaces: message.replaces || [],
                                                    onPlaced,
                                                });
                                        }}
                                        onDiscardDiagram={() => patchLive(index, { discarded: true })}
                                        onChooseStyle={(chosenStyle) => patchLive(index, { chosenStyle })}
                                    />
                                ),
                            )
                        )}
                        {pending && <PendingTurn pending={pending} />}
                    </div>
                </div>

                {!empty && (
                    <>
                        <div
                            className="pointer-events-none absolute inset-x-0 bottom-0"
                            style={{ height: composerHeight + 32, background: "linear-gradient(to top, var(--page) 64%, transparent)" }}
                        />
                        {!pinned && (
                            <button
                                type="button"
                                aria-label="Scroll to latest"
                                onClick={() => {
                                    const el = scrollRef.current;
                                    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                                }}
                                className="absolute left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-surface text-ink-2 shadow-raised transition-colors duration-150 hover:text-ink"
                                style={{ bottom: composerHeight + 12, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both" }}
                            >
                                <ArrowDown {...iconProps} />
                            </button>
                        )}
                        <div ref={composerRef} className="absolute inset-x-0 bottom-0 px-3 pb-3" data-tour="ai-composer">
                            <div className={expanded ? "mx-auto max-w-[720px]" : ""}>{composer}</div>
                            <p className="mt-1.5 text-center text-[11px] text-ink-3">The assistant can make mistakes. Review changes before applying them.</p>
                        </div>
                    </>
                )}

                {historyOpen && (
                    <>
                        <button
                            type="button"
                            aria-label="Close chat history"
                            className="absolute inset-0 z-20 bg-ink/10"
                            onClick={() => setHistoryOpen(false)}
                        />
                        <div
                            className="absolute inset-y-0 left-0 z-30 flex border-r border-line bg-page py-2.5 shadow-overlay"
                            style={{ animation: "fade-in 160ms ease-out both" }}
                        >
                            {sidebar}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
