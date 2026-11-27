"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";

/* ─────────────────────────────────────────────────────────
 * SEARCH: command search with live results and an empty state.
 * Controlled: the caller filters, groups rows into sections and
 * owns the active row; one highlight glides to it for both the
 * keyboard and the pointer.
 * ───────────────────────────────────────────────────────── */

export type SearchRow = {
  id: string;
  label: ReactNode;
  /** muted text after the label (a category, a matched snippet) */
  meta?: ReactNode;
  shortcut?: string;
  icon?: ReactNode;
  onSelect: () => void;
};

export type SearchSection = { key: string; label?: string; rows: SearchRow[] };

export type SearchListLabels = {
  placeholder: string;
  ariaLabel: string;
  emptyTitle: string;
  emptyHint: string;
};

export default function SearchList({
  query,
  onQueryChange,
  sections,
  activeId,
  onActiveChange,
  onKeyDown,
  labels,
  inputRef,
  listboxId = "search-list-listbox",
}: {
  query: string;
  onQueryChange: (query: string) => void;
  sections: SearchSection[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  labels: SearchListLabels;
  inputRef?: RefObject<HTMLInputElement>;
  listboxId?: string;
}) {
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [highlight, setHighlight] = useState<{ top: number; height: number } | null>(null);
  const empty = sections.every((section) => section.rows.length === 0);
  const optionId = (id: string) => `${listboxId}-${id}`;

  /* a single highlight glides to the active row instead of each row toggling its own */
  useLayoutEffect(() => {
    const row = activeId ? rowRefs.current[activeId] : null;
    setHighlight(row ? { top: row.offsetTop, height: row.offsetHeight } : null);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeId, sections]);

  return (
    <div className="flex max-h-full w-full flex-col overflow-hidden rounded-card bg-surface shadow-overlay">
      {/* input row */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          aria-label={labels.ariaLabel}
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeId ? optionId(activeId) : undefined}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
        {query && (
          <button
            aria-label="Clear search"
            type="button"
            onClick={() => {
              onQueryChange("");
              inputRef?.current?.focus();
            }}
            className="flex size-6 items-center justify-center rounded-full text-ink-3
              transition-colors duration-100 hover:bg-line/70 hover:text-ink"
            style={{ animation: "fade-in 150ms ease-out both" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* results / empty state */}
      <div id={listboxId} role="listbox" aria-label={labels.ariaLabel} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {empty ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-10" style={{ animation: "fade-in 250ms ease-out both" }}>
            <span className="mb-1.5 flex size-8 items-center justify-center rounded-control bg-inset text-ink-3 shadow-hairline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <span className="text-[13px] font-medium text-ink">{labels.emptyTitle}</span>
            <span className="text-[12px] text-ink-3">{labels.emptyHint}</span>
          </div>
        ) : (
          <div className="relative p-1.5">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1.5 top-0 rounded-[7px] bg-hover"
              style={{
                height: highlight?.height ?? 0,
                transform: `translateY(${highlight?.top ?? 0}px)`,
                opacity: highlight ? 1 : 0,
                transition: "transform 200ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {sections.map((section) =>
              section.rows.length === 0 ? null : (
                <div key={section.key} role="group" aria-label={section.label}>
                  {section.label && (
                    <div className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-[0.04em] text-ink-3 uppercase">{section.label}</div>
                  )}
                  {section.rows.map((row) => (
                    <button
                      key={row.id}
                      id={optionId(row.id)}
                      ref={(el) => {
                        rowRefs.current[row.id] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={row.id === activeId}
                      onMouseMove={() => row.id !== activeId && onActiveChange(row.id)}
                      onClick={row.onSelect}
                      className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] text-ink"
                    >
                      {row.icon && <span className="flex shrink-0 text-ink-3">{row.icon}</span>}
                      <span className="shrink-0">{row.label}</span>
                      {row.meta && <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.meta}</span>}
                      {!row.meta && <span className="flex-1" />}
                      {row.shortcut && (
                        <kbd className="shrink-0 rounded-[5px] bg-inset px-1.5 py-0.5 font-mono text-[11px] text-ink-2 shadow-hairline">{row.shortcut}</kbd>
                      )}
                    </button>
                  ))}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
