import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import { PIECE_DRAG_TYPE } from "./piecesApi";
import styles from "./PiecesPanel.module.css";

const SEARCH_DELAY_MS = 250;
const ICON_SIZE = 64;
const SET_FILTERS = [
    { id: "", label: "All" },
    { id: "lucide,tabler,carbon", label: "Icons" },
    { id: "devicon,logos,simple-icons", label: "Logos" },
];

// An icon as a one-element piece, so it places and drags like any other piece.
const iconPiece = (icon) => ({
    id: `${icon.set}:${icon.name}`,
    name: icon.title,
    elements: {
        i0: {
            type: "shape",
            shapeType: "Icon",
            startX: 0,
            startY: 0,
            endX: ICON_SIZE,
            endY: ICON_SIZE,
            color: "#000000",
            colorToken: "ink-primary",
            size: 0,
            fillColor: null,
            opacity: 100,
            icon: { viewBox: icon.viewBox, paths: icon.paths, set: icon.set, name: icon.name },
            zIndex: 1,
            rotation: 0,
            groupId: null,
            frameId: null,
            locked: false,
        },
    },
});

const paint = (value) => (value === "ink" ? "currentColor" : value);

const IconGlyph = ({ icon }) => (
    <svg viewBox={icon.viewBox.join(" ")} className={styles.iconGlyph} aria-hidden="true">
        {icon.paths.map((path, index) => (
            <path
                key={index}
                d={path.d}
                fill={paint(path.fill)}
                stroke={paint(path.stroke)}
                strokeWidth={path.width ?? 1}
                strokeLinecap={path.cap ?? undefined}
                strokeLinejoin={path.join ?? undefined}
                fillRule={path.evenOdd ? "evenodd" : undefined}
            />
        ))}
    </svg>
);

// Searches the icon and logo sets the server offers and places a pick as an
// icon element that takes the board's ink, or keeps a logo's own colours.
const IconBrowser = ({ onPlace }) => {
    const { data: session } = useSession();
    const token = session?.accessToken;
    const [query, setQuery] = useState("");
    const [setFilter, setSetFilter] = useState("");
    const [result, setResult] = useState({ icons: [], total: 0, loading: true, failed: false });

    useEffect(() => {
        if (!token) return undefined;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setResult((current) => ({ ...current, loading: true }));
            axiosInstance
                .get("/api/icons/search", {
                    params: { q: query, set: setFilter || undefined, limit: 60 },
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                })
                .then(({ data }) => setResult({ icons: data.icons, total: data.total, loading: false, failed: false }))
                .catch((error) => {
                    if (error?.name !== "CanceledError") setResult({ icons: [], total: 0, loading: false, failed: true });
                });
        }, SEARCH_DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, setFilter, token]);

    return (
        <div className={styles.icons}>
            <label className={styles.search}>
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search 18,000 icons and logos"
                    aria-label="Search icons and logos"
                />
            </label>
            <div className={styles.chips} role="group" aria-label="Show">
                {SET_FILTERS.map((filter) => (
                    <button
                        key={filter.label}
                        type="button"
                        className={styles.chip}
                        aria-pressed={setFilter === filter.id}
                        onClick={() => setSetFilter(filter.id)}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>
            <div className={styles.body}>
                {result.failed && <p className={styles.note}>Icons couldn&apos;t load. Check your connection and try again.</p>}
                {!result.failed && !result.loading && result.icons.length === 0 && <p className={styles.note}>No icons match &quot;{query}&quot;.</p>}
                <ul className={styles.iconGrid}>
                    {result.icons.map((icon) => {
                        const piece = iconPiece(icon);
                        return (
                            <li key={piece.id}>
                                <button
                                    type="button"
                                    className={styles.iconTile}
                                    title={`${icon.title} (${icon.set})`}
                                    aria-label={`Place ${icon.title}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData(PIECE_DRAG_TYPE, JSON.stringify(piece));
                                        e.dataTransfer.effectAllowed = "copy";
                                    }}
                                    onClick={() => onPlace(piece)}
                                >
                                    <IconGlyph icon={icon} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <p className={styles.credit}>
                    Icons from Lucide (ISC), Tabler (MIT) and Carbon (Apache 2.0). Logos from Devicon (MIT), SVG Logos and Simple Icons (CC0). Logos are
                    trademarks of their owners: use them to name the product a diagram shows.
                </p>
            </div>
        </div>
    );
};

export default IconBrowser;
