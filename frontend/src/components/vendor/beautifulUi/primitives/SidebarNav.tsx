"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChatLines, ChatPlusIn, EditPencil, MoreHoriz, NavArrowDown, Search, SidebarCollapse, SidebarExpand, Trash, Xmark } from "iconoir-react";
import GlideMenu from "./GlideMenu";

/* ─────────────────────────────────────────────────────────
 * SIDEBAR NAV
 * A collapsible chat rail: new chat, searchable recents, and a
 * per-chat menu to rename or delete. Rows share one gliding hover
 * layer; collapsing clips the 224px tree to a 52px icon rail.
 * ───────────────────────────────────────────────────────── */

const SIDEBAR_MOTION = {
  expandedWidth: 224,
  collapsedWidth: 52,
  duration: 280,
  copyDuration: 180,
  copyOffset: 8,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

const CHAT_SEARCH_MOTION = {
  duration: 180,
  closedWidth: 28,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

const iconProps = { strokeWidth: 1.8, "aria-hidden": true } as const;

export type SidebarRecent = {
  id: string;
  label: string;
};

type SidebarNavProps = {
  /** Replaces the icon rail: for a sidebar that closes outright rather than narrowing. */
  onCollapse?: () => void;
  /** the heading over the rail, e.g. the board's name */
  title: string;
  activeId?: string | null;
  className?: string;
  fill?: boolean;
  onNewChat?: () => void;
  onPick?: (id: string) => void;
  onRename?: (id: string, label: string) => void;
  onDelete?: (id: string) => void;
  recents?: SidebarRecent[];
};

function GlideGroup({ children }: { children: ReactNode }) {
  return (
    <GlideMenu
      rowSelector="[data-row]"
      highlightClassName="sidebar-glide-highlight rounded-[7px] bg-hover-2"
      className="group/glide flex flex-col gap-px"
    >
      {children}
    </GlideMenu>
  );
}

function RailButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      data-row
      type="button"
      onClick={onClick}
      className={`sidebar-row relative z-10 mx-2 flex h-8 items-center rounded-[8px] px-2 text-left
        transition-[width,background-color,color,transform] duration-150 active:scale-[0.98]
        ${active ? "bg-hover-2 group-hover/glide:bg-transparent" : ""}`}
    >
      <span className={`flex size-5 shrink-0 items-center justify-center ${active ? "text-ink" : "text-ink-2"}`}>
        {icon}
      </span>
      <span className={`sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium ${active ? "text-ink" : "text-ink-2"}`}>
        {label}
      </span>
    </button>
  );
}

function ChatMenu({
  position,
  onRename,
  onDelete,
  onClose,
}: {
  position: { top: number; left: number };
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-chat-menu]")) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return createPortal(
    <div
      data-chat-menu
      role="menu"
      className="bui fixed z-[2100] w-40 rounded-[12px] bg-surface p-1 shadow-overlay"
      style={{ top: position.top, left: position.left, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
    >
      <GlideMenu className="flex flex-col gap-px" highlightClassName="inset-x-0 rounded-[8px] bg-hover-2">
        <button data-menu-row role="menuitem" type="button" onClick={onRename} className="relative z-10 flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left">
          <span className="flex size-5 shrink-0 items-center justify-center text-ink-2"><EditPencil {...iconProps} width={15} height={15} /></span>
          <span className="text-[13px] text-ink">Rename</span>
        </button>
        <button data-menu-row role="menuitem" type="button" onClick={onDelete} className="relative z-10 flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left">
          <span className="flex size-5 shrink-0 items-center justify-center text-red"><Trash {...iconProps} width={15} height={15} /></span>
          <span className="text-[13px] text-red">Delete</span>
        </button>
      </GlideMenu>
    </div>,
    document.body,
  );
}

function RecentRow({
  item,
  active,
  onPick,
  onRename,
  onDelete,
}: {
  item: SidebarRecent;
  active: boolean;
  onPick: () => void;
  onRename?: (label: string) => void;
  onDelete?: () => void;
}) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const moreRef = useRef<HTMLButtonElement>(null);
  const hasMenu = Boolean(onRename || onDelete);

  const commitRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== item.label) onRename?.(next);
    else setDraft(item.label);
  };

  if (editing) {
    return (
      <div data-row className="sidebar-row relative z-10 mx-2 flex h-8 items-center rounded-[8px] bg-field px-1 shadow-hairline">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          aria-label="Chat name"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename();
            if (event.key === "Escape") {
              setDraft(item.label);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-1 text-[14px] font-medium text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <div
      data-row
      className={`sidebar-row group/row relative z-10 mx-2 flex h-8 items-center rounded-[8px] transition-[width,background-color,color] duration-150 ${
        active ? "bg-hover-2 group-hover/glide:bg-transparent" : ""
      }`}
    >
      <button
        type="button"
        title={item.label}
        aria-current={active ? "true" : undefined}
        onClick={onPick}
        className="flex h-full min-w-0 flex-1 items-center rounded-[8px] px-2 text-left active:scale-[0.98]"
      >
        <span className={`sidebar-copy min-w-0 flex-1 truncate text-[14px] font-medium ${active ? "text-ink" : "text-ink-2"}`}>
          {item.label}
        </span>
      </button>
      {hasMenu && (
        <button
          ref={moreRef}
          type="button"
          aria-label={`Options for ${item.label}`}
          aria-haspopup="menu"
          aria-expanded={menu !== null}
          onClick={() => {
            const rect = moreRef.current?.getBoundingClientRect();
            if (rect) setMenu({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) });
          }}
          className={`sidebar-copy mr-1 flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-3 transition-[opacity,background-color,color] duration-150 hover:bg-line-strong hover:text-ink focus-visible:opacity-100 ${
            active || menu ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
          }`}
        >
          <MoreHoriz {...iconProps} width={16} height={16} />
        </button>
      )}
      {menu && (
        <ChatMenu
          position={menu}
          onClose={() => setMenu(null)}
          onRename={() => {
            setMenu(null);
            setDraft(item.label);
            setEditing(true);
          }}
          onDelete={() => {
            setMenu(null);
            onDelete?.();
          }}
        />
      )}
    </div>
  );
}

export default function SidebarNav({
  title,
  activeId,
  className = "",
  fill = false,
  onNewChat,
  onPick,
  onRename,
  onDelete,
  recents = [],
  onCollapse,
}: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chatsOpen, setChatsOpen] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleRecents = recents.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const collapse = () => {
    setSearchOpen(false);
    setQuery("");
    if (onCollapse) onCollapse();
    else setCollapsed(true);
  };

  return (
    <aside
      data-sidebar-collapsed={collapsed}
      aria-label="Chats"
      className={`relative flex shrink-0 overflow-hidden transition-[width] ${fill ? "h-full" : "h-[600px]"} ${className}`}
      style={{
        width: collapsed ? SIDEBAR_MOTION.collapsedWidth : SIDEBAR_MOTION.expandedWidth,
        transitionDuration: `${SIDEBAR_MOTION.duration}ms`,
        transitionTimingFunction: SIDEBAR_MOTION.easing,
        "--sidebar-copy-duration": `${SIDEBAR_MOTION.copyDuration}ms`,
        "--sidebar-copy-offset": `${SIDEBAR_MOTION.copyOffset}px`,
        "--sidebar-easing": SIDEBAR_MOTION.easing,
      } as CSSProperties}
    >
      <div className="flex min-h-0 w-[224px] shrink-0 flex-col">
        <div className="relative mb-2.5 h-10 shrink-0">
          <div
            aria-hidden={collapsed}
            className="sidebar-workspace-control absolute left-2 top-1 flex h-8 w-[164px] items-center rounded-[8px] px-2"
          >
            <span className="sidebar-logo flex size-5 shrink-0 items-center justify-center text-ink">
              <ChatLines {...iconProps} width={18} height={18} />
            </span>
            <span className="sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium text-ink-2" title={title}>
              {title}
            </span>
          </div>

          <button
            type="button"
            aria-label="Collapse sidebar"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={collapse}
            className="sidebar-collapse-control absolute right-2 top-1 flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color] duration-150 hover:bg-hover-2 hover:text-ink"
          >
            <SidebarCollapse {...iconProps} width={18} height={18} />
          </button>
          <button
            type="button"
            aria-label="Expand sidebar"
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            onClick={() => setCollapsed(false)}
            className="sidebar-expand-control absolute left-2 top-0.5 flex size-9 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color] duration-150 hover:bg-hover-2 hover:text-ink"
          >
            <SidebarExpand {...iconProps} width={18} height={18} />
          </button>
        </div>

        <GlideGroup>
          <RailButton icon={<ChatPlusIn {...iconProps} width={18} height={18} />} label="New chat" onClick={onNewChat} />
        </GlideGroup>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <div className="sidebar-copy relative mx-2 mb-1 h-8">
            <button
              type="button"
              aria-hidden={searchOpen}
              aria-expanded={chatsOpen}
              tabIndex={searchOpen ? -1 : 0}
              onClick={() => setChatsOpen((open) => !open)}
              className={`absolute inset-y-0 left-0 right-9 flex items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-medium text-ink-3 transition-[opacity,transform,background-color,color] hover:bg-hover-2 hover:text-ink ${searchOpen ? "pointer-events-none -translate-x-1 opacity-0" : "translate-x-0 opacity-100"}`}
              style={{ transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`, transitionTimingFunction: CHAT_SEARCH_MOTION.easing }}
            >
              <span className="flex transition-transform duration-200" style={{ transform: chatsOpen ? "none" : "rotate(-90deg)" }}>
                <NavArrowDown {...iconProps} width={16} height={16} />
              </span>
              <span>Chats</span>
            </button>

            <button
              type="button"
              aria-label="Search chats"
              aria-expanded={searchOpen}
              onClick={() => {
                setChatsOpen(true);
                setSearchOpen(true);
              }}
              className={`absolute right-0 top-0 z-10 flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color,transform] hover:bg-hover-2 hover:text-ink active:scale-[0.96] ${searchOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
              style={{ transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms` }}
            >
              <Search {...iconProps} width={16} height={16} />
            </button>

            <div
              className={`absolute right-0 top-0 z-20 flex h-8 items-center overflow-hidden rounded-[8px] bg-field text-ink-3 shadow-hairline transition-[width,opacity] focus-within:text-ink-2 ${searchOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
              style={{
                width: searchOpen ? "100%" : CHAT_SEARCH_MOTION.closedWidth,
                transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`,
                transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
              }}
            >
              <span className="ml-2 flex shrink-0 items-center justify-center">
                <Search {...iconProps} width={15} height={15} />
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setSearchOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Search chats"
                aria-label="Search chat history"
                className="ml-1.5 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                aria-label="Close chat search"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover-2 hover:text-ink active:scale-[0.96]"
              >
                <Xmark {...iconProps} width={16} height={16} />
              </button>
            </div>
          </div>

          {chatsOpen && <GlideGroup>
            {visibleRecents.map((item) => (
              <RecentRow
                key={item.id}
                item={item}
                active={item.id === activeId}
                onPick={() => onPick?.(item.id)}
                onRename={onRename ? (label) => onRename(item.id, label) : undefined}
                onDelete={onDelete ? () => onDelete(item.id) : undefined}
              />
            ))}
            {query && visibleRecents.length === 0 && (
              <div className="sidebar-copy mx-2 px-2 py-2 text-[12.5px] text-ink-3">No chats found</div>
            )}
            {!query && recents.length === 0 && (
              <div className="sidebar-copy mx-2 px-2 py-2 text-[12.5px] text-ink-3">No chats yet</div>
            )}
          </GlideGroup>}
        </div>
      </div>
    </aside>
  );
}
