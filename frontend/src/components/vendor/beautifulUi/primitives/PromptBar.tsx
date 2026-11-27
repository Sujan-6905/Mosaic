"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: / commands, a mode picker,
 * context chips, dictation, and send (stop while busy).
 * Type / to open the command menu; ↑↓ + Enter to pick.
 * Variants: Rounded (card radius) · Pill (full radius).
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export type PromptMode = { key: string; name: string; tag: string };
/** `prompt` replaces the typed /command in the draft, ready to edit before sending;
 * `mode`, when set, switches the mode picker to match */
export type PromptCommand = { key: string; name: string; desc: string; prompt: string; mode?: string };
export type PromptContextChip = { key: string; label: string; onRemove?: () => void };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const speechRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
};

/* the last /word being typed, if any */
function parseToken(draft: string): { query: string; start: number } | null {
  const match = /(^|\s)\/([\w-]*)$/.exec(draft);
  if (!match) return null;
  return { query: match[2].toLowerCase(), start: match.index + match[1].length };
}

export default function PromptBar({
  variant = "Rounded",
  tall = false,
  placeholder,
  onSend,
  modes = [],
  mode,
  onModeChange,
  commands = [],
  context = [],
  busy = false,
  onStop,
  disabled = false,
  autoFocus = false,
  menuBoundsRef,
}: {
  variant?: string;
  /** hero sizing: a multi-line input with controls on their own row */
  tall?: boolean;
  placeholder?: string;
  onSend?: (text: string) => void;
  /** what the next message does; the picker hides when there is only one */
  modes?: PromptMode[];
  mode?: string;
  onModeChange?: (key: string) => void;
  commands?: PromptCommand[];
  /** chips riding above the input describing what the message will act on */
  context?: PromptContextChip[];
  /** a reply is in flight: send turns into stop */
  busy?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** the element the command menu must stay inside when the composer sits near its top */
  menuBoundsRef?: React.RefObject<HTMLElement | null>;
}) {
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [dictationSupported, setDictationSupported] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<{ below: boolean; maxHeight: number | null }>({ below: false, maxHeight: null });
  const wide = expanded || tall;
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = useState(0);
  const [modelMenuBottom, setModelMenuBottom] = useState(0);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const currentMode = modes.find((m) => m.key === mode) ?? modes[0];
  const showModes = modes.length > 1;
  const showPlus = commands.length > 0;

  const token = dismissed ? null : parseToken(draft);
  const menuOpen = commands.length > 0 && (plusOpen || token !== null);
  const query = plusOpen ? "" : token?.query ?? "";
  const rows = menuOpen ? commands.filter((c) => c.name.slice(1).startsWith(query)) : [];

  useEffect(() => {
    setDictationSupported(speechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menuOpen, query]);

  /* The menu grows up from the composer, unless the composer sits so high in
   * its container that the rows would slide under what's above it. */
  useLayoutEffect(() => {
    const bounds = menuBoundsRef?.current;
    const anchor = composerAnchorRef.current;
    if (!menuOpen || !bounds || !anchor) return;
    const MENU_GAP = 8;
    const MENU_CHROME = 42;
    const wanted = rows.length * 36 + MENU_CHROME + MENU_GAP;
    const boundsRect = bounds.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const above = anchorRect.top - boundsRect.top;
    const below = boundsRect.bottom - anchorRect.bottom;
    const goBelow = above < wanted && below > above;
    const room = (goBelow ? below : above) - MENU_GAP;
    setMenuPlacement({ below: goBelow, maxHeight: room < wanted ? Math.max(room, 96) : null });
  }, [menuOpen, rows.length, menuBoundsRef]);

  /* a single highlight glides to the active row instead of each row
   * toggling its own background, matching the gliding pill in the nav */
  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menuOpen, query, active, rows.length]);

  /* same gliding highlight in the mode menu: it floats to the hovered
   * row, falling back to the currently-selected mode */
  const modeIndex = modes.findIndex((m) => m.key === currentMode?.key);
  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? modeIndex];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modeIndex]);

  /* The menu is outside the clipped composer, so align it to the mode
   * trigger by measurement instead of pinning it to the far-right edge. */
  useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return;
    const anchorRect = composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = modelRef.current.getBoundingClientRect();
    setModelMenuLeft(Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 208)));
    setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [modelOpen, wide, currentMode?.name]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleDictation = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = speechRecognitionCtor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
      if (transcript) setDraft((current) => (current ? `${current.trimEnd()} ${transcript}` : transcript));
    };
    recognition.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const trailingButtons = (dictationSupported ? 1 : 0) + 1;
  const plusCols = showPlus ? 1 : 0;
  const modeCols = showModes ? 1 : 0;
  const gridTemplateColumns = (
    wide
      ? [showPlus && "28px", showModes && "auto", "minmax(0,1fr)", ...Array(trailingButtons).fill("28px")]
      : [showPlus && "28px", "minmax(0,1fr)", showModes && "auto", ...Array(trailingButtons).fill("28px")]
  )
    .filter(Boolean)
    .join(" ");
  const micCol = plusCols + modeCols + 2;
  const sendCol = micCol + (dictationSupported ? 1 : 0);

  /* Move wrapped text above the controls, then grow to a compact maximum. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    if (!input || !controls || !measure) return;

    const fixedControlsWidth = 28 * (plusCols + trailingButtons) + (modelRef.current?.offsetWidth ?? 0);
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }

    const minHeight = 28;
    const maxHeight = tall ? 160 : 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded, plusCols, trailingButtons, tall]);

  /* clicking anywhere outside the composer closes the open menus */
  useEffect(() => {
    if (!modelOpen && !plusOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]")) {
        setModelOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [modelOpen, plusOpen]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (row: PromptCommand) => {
    setDraft(`${token ? draft.slice(0, token.start) : draft}${row.prompt}`);
    if (row.mode) onModeChange?.(row.mode);
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = !disabled && !busy && draft.trim().length > 0;
  const send = () => {
    if (!canSend) return;
    onSend?.(draft.trim());
    setDraft("");
    closeMenus();
  };

  /* inline: one row, input second; wide: input spans the top row, controls sit below */
  const place = (col: number): CSSProperties => ({ gridColumnStart: col, gridRowStart: wide ? 2 : 1 });
  const modeCol = wide ? plusCols + 1 : plusCols + 2;

  return (
    <div data-promptbar className="w-full">
      {/* composer is the anchor: menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
      {/* ── slash menu ─────────────────────────────────── */}
      {menuOpen && (
        <div
          onMouseLeave={() => setEngaged(false)}
          className={`absolute inset-x-0 z-30 overflow-y-auto rounded-[10px] bg-surface p-1 shadow-raised ${menuPlacement.below ? "top-full mt-2" : "bottom-full mb-2"}`}
          style={{
            maxHeight: menuPlacement.maxHeight ?? undefined,
            animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
            transformOrigin: menuPlacement.below ? "top center" : "bottom center",
          }}
        >
          {/* single gliding highlight, shown once a row is hovered */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
            style={{
              top: rowBox?.top ?? 0,
              height: rowBox?.height ?? 0,
              opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {rows.map((row, i) => (
            <button
              key={row.key}
              type="button"
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                setActive(i);
                setEngaged(true);
              }}
              onClick={() => pick(row)}
              className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
            >
              <span className="shrink-0 text-[12.5px] font-medium text-ink">
                {row.name}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
            </button>
          ))}
          {rows.length === 0 && (
            <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">
              No matches for “{query}”
            </div>
          )}
          <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
            Type to search commands
          </div>
        </div>
      )}

      {/* ── mode menu ──────────────────────────────────── */}
      {modelOpen && (
        <div
          role="listbox"
          aria-label="Mode"
          onMouseLeave={() => setModelHovered(null)}
          className="absolute z-10 w-52 rounded-[10px] bg-surface p-1 shadow-raised"
          style={{ left: modelMenuLeft, bottom: modelMenuBottom, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
        >
          {/* single gliding highlight, floating to the hovered or selected row */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
            style={{
              top: modelBox?.top ?? 0,
              height: modelBox?.height ?? 0,
              opacity: modelBox && modelHovered !== null ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {modes.map((m, i) => (
            <button
              key={m.key}
              type="button"
              role="option"
              aria-selected={m.key === currentMode?.key}
              ref={(el) => {
                modelRowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setModelHovered(i)}
              onClick={() => {
                onModeChange?.(m.key);
                setModelOpen(false);
                inputRef.current?.focus();
              }}
              className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{m.name}</span>
              <span className="shrink-0 text-[11px] text-ink-3">{m.tag}</span>
              <span className={`shrink-0 text-ink ${m.key === currentMode?.key ? "" : "invisible"}`}>
                <Icon size={13} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></Icon>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── composer ───────────────────────────────────── */}
      <div
        className={`relative isolate flex flex-col overflow-hidden border border-line bg-surface shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${
          tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
        } ${
          pill ? (context.length > 0 || wide ? "rounded-[24px]" : "rounded-full") : tall ? "rounded-[22px]" : "rounded-[14px]"
        }`}
      >
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {draft}
        </span>

        {context.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
            {context.map((chip) => (
              <span
                key={chip.key}
                className={`flex h-6.5 items-center gap-1.5 bg-field py-1 pl-1.5 text-[11.5px] text-ink-2 shadow-hairline ${
                  chip.onRemove ? "pr-1" : "pr-2"
                } ${pill ? "rounded-full" : "rounded-chip"}`}
                style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
              >
                <Icon size={12}><g><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M14 6.5h3.5A2.5 2.5 0 0 1 20 9v1M10 17.5H6.5A2.5 2.5 0 0 1 4 15v-1" /></g></Icon>
                <span className="max-w-48 truncate">{chip.label}</span>
                {chip.onRemove && (
                  <button
                    type="button"
                    aria-label={`Remove ${chip.label}`}
                    onClick={chip.onRemove}
                    className={`-my-1 flex size-6 items-center justify-center text-ink-3 transition-colors duration-100 hover:bg-line/70 hover:text-ink ${
                      pill ? "rounded-full" : "rounded-[5px]"
                    }`}
                  >
                    <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div ref={controlsRef} className="grid items-end gap-x-1 gap-y-1.5" style={{ gridTemplateColumns }}>
          {showPlus && (
            <button
              type="button"
              aria-label="Commands"
              aria-expanded={plusOpen}
              onClick={() => {
                setModelOpen(false);
                setPlusOpen((current) => !current);
                inputRef.current?.focus();
              }}
              style={place(1)}
              className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${plusOpen ? "bg-hover text-ink" : ""}`}
            >
              <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
            </button>
          )}

          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => {
              setDraft(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (menuOpen && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape" && (menuOpen || modelOpen)) {
                event.stopPropagation();
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={listening ? "Listening…" : placeholder ?? "Write a message…"}
            aria-label="Message"
            style={wide ? { gridColumn: "1 / -1", gridRowStart: 1 } : { gridColumnStart: plusCols + 1, gridRowStart: 1 }}
            className={`${tall ? "min-h-[68px] px-2 py-2 text-[14px] leading-5" : "min-h-7 px-1 py-[5px] text-[13px] leading-[18px]"} min-w-0 w-full resize-none bg-transparent text-ink outline-none [overflow-wrap:anywhere] placeholder:text-ink-3 disabled:cursor-not-allowed`}
          />

          {/* mode picker */}
          {showModes && currentMode && (
            <button
              ref={modelRef}
              type="button"
              aria-expanded={modelOpen}
              aria-haspopup="listbox"
              aria-label={`Mode: ${currentMode.name}`}
              onClick={() => {
                setPlusOpen(false);
                setModelOpen((current) => !current);
              }}
              style={place(modeCol)}
              className={`flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${wide ? "justify-self-start" : ""}`}
            >
              {currentMode.name}
              <span className="text-ink-3">
                <Icon size={11} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></Icon>
              </span>
            </button>
          )}

          {/* dictation */}
          {dictationSupported && (
            <button
              type="button"
              aria-label={listening ? "Stop dictation" : "Start dictation"}
              aria-pressed={listening}
              onClick={toggleDictation}
              disabled={disabled}
              style={place(micCol)}
              className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${listening ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink"}`}
            >
              {listening ? (
                <span className="flex h-3.5 items-center gap-[2.5px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-[2.5px] rounded-full bg-current"
                      style={{ height: "100%", animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite` }}
                    />
                  ))}
                </span>
              ) : (
                <Icon size={15} strokeWidth={2}><g><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></g></Icon>
              )}
            </button>
          )}

          {/* send, or stop while a reply is in flight: a tactile square (round in the pill variant) */}
          {busy ? (
            <button
              type="button"
              aria-label="Stop"
              onClick={onStop}
              style={{ ...place(sendCol), background: "var(--ink)", color: "var(--surface)" }}
              className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              }`}
            >
              <span className="size-2.5 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              onClick={send}
              style={{
                ...place(sendCol),
                background: canSend ? "var(--ink)" : "var(--line-strong)",
                color: canSend ? "var(--surface)" : "var(--ink-2)",
              }}
              className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              }`}
            >
              <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
