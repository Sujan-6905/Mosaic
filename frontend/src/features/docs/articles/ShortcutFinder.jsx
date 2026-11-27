import { useEffect, useMemo, useState } from "react";
import { MENU_ITEM_SHORTCUTS } from "@/features/board/tools/toolSettings";
import { BOARD_GESTURES } from "@/features/board/input/boardGestures";
import { Keys } from "./primitives";
import styles from "./ShortcutFinder.module.css";

const TOOL_LABELS = { Fill_Color: "Fill colour", Sticky: "Sticky note", Bucket: "Fill bucket", Laser: "Laser pointer", Pencil: "Pencil and pens" };

const GROUPS = [
    {
        category: "Tools",
        items: Object.entries(MENU_ITEM_SHORTCUTS).map(([tool, combo]) => ({ label: TOOL_LABELS[tool] ?? tool, keys: combo.split("+") })),
    },
    ...BOARD_GESTURES,
];

const keyName = (event) => {
    if (event.key === " ") return "space";
    if (event.key === "Control") return "ctrl";
    return event.key.toLowerCase();
};

// Pressing a key lights every row that uses it, so the list answers "what does this key do?" as well as the reverse.
export default function ShortcutFinder() {
    const [query, setQuery] = useState("");
    const [pressed, setPressed] = useState(null);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.target.closest?.("input, textarea, [contenteditable]") || event.metaKey) return;
            setPressed(keyName(event));
        };
        const onKeyUp = () => setPressed(null);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => !needle || `${item.label} ${item.keys.join(" ")}`.toLowerCase().includes(needle)),
        })).filter((group) => group.items.length);
    }, [query]);

    return (
        <div className={styles.finder}>
            <div className={styles.bar}>
                <input
                    type="search"
                    className={styles.search}
                    placeholder="Filter by name, or press any key"
                    aria-label="Filter shortcuts"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <span className={styles.pressed} aria-live="polite">
                    {pressed ? (
                        <>
                            Lit for <Keys keys={[pressed.length === 1 ? pressed.toUpperCase() : pressed[0].toUpperCase() + pressed.slice(1)]} />
                        </>
                    ) : (
                        "Press a key to light it up"
                    )}
                </span>
            </div>
            {groups.map((group) => (
                <section key={group.category} className={styles.group}>
                    <h3 className={styles.groupTitle}>{group.category}</h3>
                    <ul className={styles.rows}>
                        {group.items.map((item) => (
                            <li
                                key={`${item.label}-${item.keys.join("+")}`}
                                className={styles.row}
                                data-lit={Boolean(pressed && item.keys.some((key) => key.toLowerCase() === pressed))}
                            >
                                <span>{item.label}</span>
                                <Keys keys={item.keys} />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
            {groups.length === 0 && <p className={styles.empty}>Nothing matches that. Try a tool name, or a key such as Shift.</p>}
        </div>
    );
}
