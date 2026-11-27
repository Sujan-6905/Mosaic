"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT
 * Words resolve in one at a time, then actions and follow-up
 * prompts become usable. Past replies render settled.
 * ───────────────────────────────────────────────────────── */

const WORD_MS = 34;

const ACTION_GLYPHS: Record<string, React.ReactNode> = {
  copy: <g><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>,
  copied: <path d="M20 6L9 17l-5-5" />,
  retry: <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />,
};

export type StreamingAction = {
  key: string;
  label: string;
  /** one of the built-in glyphs: copy, copied, retry */
  glyph: keyof typeof ACTION_GLYPHS;
  onClick: () => void;
};

export default function StreamingText({
  text,
  instant = false,
  tone = "ink",
  actions = [],
  followUps = [],
  followUpsLabel = "Follow-ups",
  onDone,
  onFollowUp,
}: {
  text: string;
  /** render the whole reply at once, for history rather than a fresh answer */
  instant?: boolean;
  tone?: "ink" | "ink-2" | "red";
  actions?: StreamingAction[];
  /** follow-up prompt suggestions shown once the stream completes */
  followUps?: string[];
  followUpsLabel?: string;
  onDone?: () => void;
  /** fired when a follow-up prompt is chosen */
  onFollowUp?: (text: string, index: number) => void;
}) {
  const words = text.split(" ");
  const [count, setCount] = useState(instant ? words.length : 0);
  const done = count >= words.length;

  useEffect(() => {
    if (done) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setCount((c) => c + 1), WORD_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, done]);

  const toneClass = tone === "red" ? "text-red" : tone === "ink-2" ? "text-ink-2" : "text-ink";

  return (
    <div className="w-full">
      <p className={`text-[13.5px] leading-[1.65] whitespace-pre-wrap ${toneClass}`}>
        {words.slice(0, count).map((word, i) => (
          <span key={i} className="inline">
            {word}{i < count - 1 ? " " : ""}
          </span>
        ))}
        {!done && <span className="stream-caret is-streaming" />}
      </p>

      {actions.length > 0 && (
        <div
          className="mt-1.5 -ml-1 flex items-center gap-0.5 transition-opacity duration-400"
          style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              aria-label={action.label}
              title={action.label}
              onClick={action.onClick}
              className="flex size-6 items-center justify-center rounded-[6px] text-ink-3
                transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ACTION_GLYPHS[action.glyph]}
              </svg>
            </button>
          ))}
        </div>
      )}

      {followUps.length > 0 && (
        <div
          className="mt-2.5 transition-opacity duration-400"
          style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
        >
          <p className="text-[12px] font-medium text-ink-2">{followUpsLabel}</p>
          <div className="mt-0.5 flex flex-col">
            {followUps.map((followUp, i) => (
              <button
                key={followUp}
                type="button"
                onClick={() => onFollowUp?.(followUp, i)}
                className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-line
                  px-1.5 py-1.5 text-left text-[12.5px] text-ink transition-colors
                  duration-100 hover:bg-hover-2"
                style={
                  done
                    ? { animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }
                    : { opacity: 0 }
                }
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                  <path d="M9 10l-5 5 5 5" />
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                </svg>
                {followUp}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
