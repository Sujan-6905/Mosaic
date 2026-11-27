import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines } from "@fortawesome/free-solid-svg-icons";
import SearchList from "@/components/vendor/beautifulUi/primitives/SearchList";
import StrokeIcon from "@/components/ui/StrokeIcon";
import axiosInstance from "@/lib/axiosInstance";
import { filterCommands } from "./commandMatch";
import { getRecentCommandIds, recordRecentCommand } from "./recentCommands";
import styles from "./CommandPalette.module.css";

const BOARD_SEARCH_MIN_LENGTH = 2;
const BOARD_SEARCH_DEBOUNCE_MS = 300;

const CATEGORY_ORDER = ["Tools", "Edit", "Style", "View", "Board", "AI", "Navigate"];
const CATEGORY_ICONS = { Tools: "select", Edit: "duplicate", Style: "eyedropper", View: "fit", Board: "history", AI: "sparkle", Navigate: "chevronRight" };
const COMMAND_ICONS = {
    "edit:undo": "undo",
    "edit:redo": "redo",
    "edit:group": "arrange",
    "edit:ungroup": "arrange",
    "edit:toggleLock": "lock",
    "edit:tidyUpTopDown": "grid",
    "edit:tidyUpLeftRight": "grid",
    "edit:tidyUpRadial": "grid",
    "view:zoomIn": "plus",
    "view:zoomOut": "minus",
    "board:export": "export",
    "board:import": "download",
    "board:replay": "play",
    "board:clear": "trash",
};
const TOOL_ICONS = {
    Select: "select",
    Hand: "hand",
    Pencil: "pencil",
    Eraser: "eraser",
    Rectangle: "shapes",
    Ellipse: "ellipse",
    Triangle: "triangle",
    Diamond: "diamond",
    Star: "star",
    Arrow: "arrow",
    Line: "line",
    Text: "text",
    Sticky: "sticky",
    Image: "image",
    Frame: "frame",
    Connector: "connector",
    Laser: "laser",
    Comment: "comment",
};

const iconNameFor = (command) => {
    if (command.id.startsWith("tool:")) return TOOL_ICONS[command.id.slice("tool:".length)] ?? CATEGORY_ICONS.Tools;
    return COMMAND_ICONS[command.id] ?? CATEGORY_ICONS[command.category] ?? "more";
};

// Filters, ranks and runs the commands it is given. Board results use the dashboard's search endpoint.
const CommandPalette = ({ isOpen, onClose, commands, token, showToast }) => {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [boardResults, setBoardResults] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setBoardResults([]);
            setActiveIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    const recentCommands = useMemo(() => {
        if (query.trim()) return [];
        const recentIds = getRecentCommandIds();
        return recentIds.map((id) => commands.find((c) => c.id === id)).filter(Boolean);
    }, [commands, query]);

    const matchedCommands = useMemo(() => filterCommands(commands, query), [commands, query]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!isOpen || !token || trimmed.length < BOARD_SEARCH_MIN_LENGTH) {
            setBoardResults([]);
            return;
        }
        const timer = setTimeout(() => {
            axiosInstance
                .get(`/api/search?q=${encodeURIComponent(trimmed)}`, { headers: { Authorization: `Bearer ${token}` } })
                .then(({ data }) => setBoardResults(data.results.slice(0, 5)))
                .catch(() => {
                    setBoardResults([]);
                    showToast?.error("Error", "Board search failed.");
                });
        }, BOARD_SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [isOpen, query, token, showToast]);

    const runCommand = useCallback(
        (command) => {
            recordRecentCommand(command.id);
            onClose();
            command.run();
        },
        [onClose],
    );

    const openBoardResult = useCallback(
        (result) => {
            onClose();
            const params = new URLSearchParams({ shareId: result.shareId });
            if (result.match?.elementId) params.set("focusElementId", result.match.elementId);
            router.push(`/?${params.toString()}`);
        },
        [onClose, router],
    );

    // Recent commands only show for an empty query, so a row is never in
    // two sections at once and the up/down order stays unambiguous.
    const commandRowFor = (command) => ({
        id: `command-${command.id}`,
        icon: <StrokeIcon name={iconNameFor(command)} size={15} />,
        label: command.label,
        shortcut: command.shortcut,
        onSelect: () => runCommand(command),
    });
    const sections = query.trim()
        ? [
              { key: "commands", rows: matchedCommands.map(commandRowFor) },
              {
                  key: "boards",
                  label: "Boards",
                  rows: boardResults.map((result) => ({
                      id: `board-${result.shareId}`,
                      icon: <FontAwesomeIcon icon={faFileLines} />,
                      label: result.title || "Untitled board",
                      meta: `\u201c${result.match.text}\u201d`,
                      onSelect: () => openBoardResult(result),
                  })),
              },
          ]
        : [
              { key: "recent", label: "Recent", rows: recentCommands.map(commandRowFor) },
              ...CATEGORY_ORDER.map((category) => ({
                  key: category,
                  label: category,
                  rows: matchedCommands.filter((command) => command.category === category).map(commandRowFor),
              })),
          ];
    const rows = sections.flatMap((section) => section.rows);

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            onClose();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, rows.length - 1));
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            rows[activeIndex]?.onSelect();
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
            <div className={`bui ${styles.palette}`} onMouseDown={(e) => e.stopPropagation()} data-board-chrome>
                <SearchList
                    query={query}
                    onQueryChange={(next) => {
                        setQuery(next);
                        setActiveIndex(0);
                    }}
                    sections={sections}
                    activeId={rows[activeIndex]?.id ?? null}
                    onActiveChange={(id) => setActiveIndex(rows.findIndex((row) => row.id === id))}
                    onKeyDown={handleKeyDown}
                    inputRef={inputRef}
                    listboxId="command-palette-listbox"
                    labels={{
                        placeholder: "Search commands or boards…",
                        ariaLabel: "Search commands or boards",
                        emptyTitle: "No matching commands or boards",
                        emptyHint: "Try a different word, or a board's title",
                    }}
                />
            </div>
        </div>
    );
};

export default CommandPalette;
