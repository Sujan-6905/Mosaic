import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TOUR_TRACKS } from "@/features/tour/tourSteps";
import { BOARD_GESTURES } from "@/features/board/input/boardGestures";
import usePresence from "@/hooks/usePresence";
import pkg from "../../../package.json";
import { SOURCE_URL } from "@/features/site/siteContent";
import styles from "./index.module.css";

const TABS = [
    { id: "tutorials", label: "Tutorials", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM10 8l6 4-6 4z" },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10" },
    { id: "resources", label: "Resources", icon: "M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5A2.5 2.5 0 006.5 22H20v-5" },
];

const TRACK_LOOKS = {
    arrows: {
        tone: "coral",
        icon: "M5 19L19 5M12 5h7v7",
        body: "Attaching arrows, curves and elbows, heads, quick connect, line and fill styles, the fill bucket, lasso and paste.",
    },
    catchUp: {
        tone: "sky",
        icon: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
        body: "What changed since you were last here, with mentions first and every change marked on the board.",
    },
    architecture: {
        tone: "mint",
        icon: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
        body: "Map any public GitHub repository, keep it in sync, and see what a pull request changes.",
    },
    tables: {
        tone: "gold",
        icon: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14",
        body: "Tables and their four looks, rich text while typing, and Ctrl F to find any word on the board.",
    },
    diagramStyles: {
        tone: "lilac",
        icon: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
        body: "Asking for one of 72 structures in one of 43 looks, restyling a diagram, and the built-in kits.",
    },
    workshop: {
        tone: "coral",
        icon: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
        body: "A shared timer, dot voting with results, and stamps for quick reactions.",
    },
    pieces: {
        tone: "mint",
        icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13v7M13 16.5h7",
        body: "Placing ready-made pieces, saving your own sets, Mermaid to board, and board properties.",
    },
    basics: { tone: "gold", icon: "M4 3l16 7-7 2.5L10 20z", body: "Tools, shapes, stickies, frames, styling a selection, undo, and moving around the board." },
    collaboration: {
        tone: "sky",
        icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9",
        body: "Inviting people, roles, the board link, following, presenting and comment threads.",
    },
    ai: {
        tone: "lilac",
        icon: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z",
        body: "Opens the assistant and shows how to draw, place, edit, follow up, and what it won't do.",
    },
    versions: {
        tone: "mint",
        icon: "M3 12a9 9 0 109-9 9 9 0 00-7 3.4M3 4v4h4M12 7v5l3 2",
        body: "Naming a moment, previewing any past version, restoring it or forking from it.",
    },
    replay: { tone: "coral", icon: "M5 4l14 8-14 8z", body: "Playing back how a board was made, scrubbing, following one person and changing speed." },
    branches: {
        tone: "sky",
        icon: "M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",
        body: "Copying a board to try an idea, then comparing the two with every change marked.",
    },
    files: { tone: "gold", icon: "M12 3v12M7 10l5 5 5-5M4 21h16", body: "PNG, SVG, PDF and .mosaic, what to include, and what can be imported back." },
    shortcuts: {
        tone: "lilac",
        icon: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
        body: "One letter for every tool, the edit keys worth learning, and the command palette.",
    },
    organisation: {
        tone: "mint",
        icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
        body: "Search by what's written on boards, categories and starring.",
    },
};

const RESOURCES = [
    {
        href: "/docs",
        title: "Documentation",
        body: "Every feature explained, with search.",
        icon: "M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM8 7h8M8 11h6",
    },
    {
        href: "/docs/agents",
        title: "Connect an AI agent",
        body: "Claude, Cursor, VS Code or Codex on a board, over MCP.",
        icon: "M12 2a4 4 0 014 4v2H8V6a4 4 0 014-4zM5 8h14v8a4 4 0 01-4 4H9a4 4 0 01-4-4zM9 13h.01M15 13h.01",
    },
    {
        href: "/docs/diagrams",
        title: "Diagrams and styles",
        body: "Structures, looks, Mermaid and GitHub repositories.",
        icon: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
    },
    {
        href: "/pieces",
        title: "Pieces gallery",
        body: "Ready-made sets people share: notations, cloud parts, wireframes.",
        icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13v7M13 16.5h7",
    },
    {
        href: "/docs/embeds",
        title: "Embeds and links",
        body: "Live boards on other sites, Slack and cover letters.",
        icon: "M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
    },
    {
        href: "/docs/workshops",
        title: "Running a workshop",
        body: "A shared timer, dot voting and stamps.",
        icon: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
    },
    {
        href: "/about",
        title: "How Mosaic works",
        body: "The decisions underneath: conflict, history, the assist, agents, scale.",
        icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 16v-4M12 8h.01",
    },
    {
        href: "/about#index",
        title: "Everything that shipped",
        body: "Every capability, grouped by area.",
        icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    },
    {
        href: "/docs/hidden-details",
        title: "Hidden details",
        body: "The small surprises tucked around the app.",
        icon: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z",
    },
    {
        href: SOURCE_URL,
        title: "Source on GitHub",
        body: "Read the code, open an issue.",
        icon: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 00-.9-2.6c3.1-.3 6.4-1.5 6.4-7A5.4 5.4 0 0020 4.8 5 5 0 0019.9 1S18.7.7 16 2.5a13.4 13.4 0 00-7 0C6.3.7 5.1 1 5.1 1A5 5 0 005 4.8a5.4 5.4 0 00-1.5 3.7c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 00-.9 2.6V22",
    },
];

const Icon = ({ d, size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d={d} />
    </svg>
);

const HelpMenu = ({ isOpen, onClose, commands = [], tourTrackIds = [], onStartTour, toolsNote, openOnTab = null }) => {
    const [tab, setTab] = useState("tutorials");
    const [filter, setFilter] = useState("");
    const panelRef = useRef(null);
    const { mounted, closing } = usePresence(isOpen, 180);
    const buildId = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";

    useEffect(() => {
        if (!isOpen) return undefined;
        setTab(openOnTab ?? (tourTrackIds.length ? "tutorials" : commands.length ? "shortcuts" : "resources"));
        panelRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
        // Re-picks the tab on open or when a tab is asked for, not when a caller's arrays change identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, openOnTab]);

    const shortcutGroups = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        const groups = new Map();
        commands
            .filter(
                (command) => command.shortcut && (!needle || command.label.toLowerCase().includes(needle) || command.shortcut.toLowerCase().includes(needle)),
            )
            .forEach((command) => {
                const name = command.category || "General";
                if (!groups.has(name)) groups.set(name, []);
                groups.get(name).push(command);
            });
        return [...groups.entries()];
    }, [commands, filter]);

    const gestureGroups = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        return BOARD_GESTURES.map(({ category, items }) => ({
            category,
            items: items.filter((item) => !needle || item.label.toLowerCase().includes(needle) || item.keys.join(" ").toLowerCase().includes(needle)),
        })).filter(({ items }) => items.length > 0);
    }, [filter]);

    if (!mounted) return null;

    return (
        <div className={styles.overlay} data-closing={closing || undefined} onClick={onClose} data-board-chrome data-lenis-prevent>
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="helpTitle"
                className={styles.dialog}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={styles.head}>
                    <h2 id="helpTitle" className={styles.title}>
                        Help and resources
                    </h2>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                        <Icon d="M6 6l12 12M18 6L6 18" size={14} />
                    </button>
                </div>
                <div className={styles.shell}>
                    <div className={styles.tabs} role="tablist" aria-orientation="vertical" aria-label="Help sections">
                        {TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                id={`help-tab-${item.id}`}
                                aria-selected={tab === item.id}
                                aria-controls="help-panel"
                                className={styles.tab}
                                onClick={() => setTab(item.id)}
                            >
                                <Icon d={item.icon} />
                                {item.label}
                            </button>
                        ))}
                        <span className={styles.version}>
                            Mosaic v{pkg.version} · build {buildId}
                        </span>
                    </div>

                    <div id="help-panel" role="tabpanel" aria-labelledby={`help-tab-${tab}`} className={styles.panel}>
                        {tab === "tutorials" &&
                            (tourTrackIds.length ? (
                                <div className={styles.stack}>
                                    <p className={styles.lede}>
                                        Each tutorial opens the real panels and walks you through them, a step at a time. You can use the board while it runs,
                                        and leave whenever you like.
                                    </p>
                                    <div className={styles.tracks}>
                                        {tourTrackIds.map((id) => {
                                            const look = TRACK_LOOKS[id];
                                            const steps = TOUR_TRACKS[id].steps.length;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    className={styles.track}
                                                    style={{ "--i": tourTrackIds.indexOf(id) }}
                                                    onClick={() => {
                                                        onStartTour?.(id);
                                                        onClose();
                                                    }}
                                                >
                                                    <span className={styles.trackTop}>
                                                        <span className={styles.trackChip} data-tone={look.tone}>
                                                            <Icon d={look.icon} size={17} />
                                                        </span>
                                                        <span className={styles.steps}>
                                                            {steps} step{steps === 1 ? "" : "s"}
                                                        </span>
                                                    </span>
                                                    <strong className={styles.trackTitle}>{TOUR_TRACKS[id].label}</strong>
                                                    <span className={styles.trackBody}>{look.body}</span>
                                                    <span className={styles.start}>
                                                        Start
                                                        <Icon d="M5 12h14M13 6l6 6-6 6" size={13} />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {toolsNote && <p className={styles.note}>{toolsNote}</p>}
                                </div>
                            ) : (
                                <p className={styles.lede}>
                                    This page has no tutorials of its own. Open a board for the editor tours, or All boards for organising.
                                </p>
                            ))}

                        {tab === "shortcuts" &&
                            (commands.length ? (
                                <div className={styles.stack} data-tour="help-shortcuts">
                                    <label className={styles.filter}>
                                        <Icon d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5" size={15} />
                                        <input
                                            type="search"
                                            value={filter}
                                            onChange={(event) => setFilter(event.target.value)}
                                            placeholder="Find a shortcut"
                                            aria-label="Find a shortcut"
                                        />
                                        <span className={styles.filterHint}>Everything is also in Ctrl K</span>
                                    </label>
                                    <div className={styles.groups}>
                                        {shortcutGroups.map(([name, items]) => (
                                            <section key={name}>
                                                <h3 className={styles.groupName}>{name}</h3>
                                                {items.map((command) => (
                                                    <div key={command.id} className={styles.shortcut}>
                                                        <span>{command.label}</span>
                                                        <span className={styles.keys}>
                                                            {command.shortcut.split("+").map((key) => (
                                                                <kbd key={key}>{key}</kbd>
                                                            ))}
                                                        </span>
                                                    </div>
                                                ))}
                                            </section>
                                        ))}
                                        {gestureGroups.map(({ category, items }) => (
                                            <section key={category}>
                                                <h3 className={styles.groupName}>{category}</h3>
                                                {items.map((item) => (
                                                    <div key={`${item.label}-${item.keys.join("+")}`} className={styles.shortcut}>
                                                        <span>{item.label}</span>
                                                        <span className={styles.keys}>
                                                            {item.keys.map((key) => (
                                                                <kbd key={key}>{key}</kbd>
                                                            ))}
                                                        </span>
                                                    </div>
                                                ))}
                                            </section>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className={styles.lede}>Keyboard shortcuts belong to the board editor. Open a board to see them here.</p>
                            ))}

                        {tab === "resources" && (
                            <div className={styles.resources}>
                                {RESOURCES.map((resource) => {
                                    const external = resource.href.startsWith("http");
                                    const content = (
                                        <>
                                            <span className={styles.resourceIcon}>
                                                <Icon d={resource.icon} size={18} />
                                            </span>
                                            <span className={styles.resourceText}>
                                                <strong>{resource.title}</strong>
                                                <span>{resource.body}</span>
                                            </span>
                                            <Icon d="M7 17L17 7M9 7h8v8" size={15} />
                                        </>
                                    );
                                    return external ? (
                                        <a key={resource.title} className={styles.resource} href={resource.href} target="_blank" rel="noopener noreferrer">
                                            {content}
                                        </a>
                                    ) : (
                                        <Link key={resource.title} className={styles.resource} href={resource.href} onClick={onClose}>
                                            {content}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpMenu;
