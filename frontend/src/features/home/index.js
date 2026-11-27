import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import GlideMenu from "@/components/vendor/beautifulUi/primitives/GlideMenu";
import AppHeader from "@/components/AppHeader";
import { parseSceneFile, SCENE_IMPORT_ERROR_MESSAGES } from "@/features/board/exportImport/sceneSerializer";
import useAppSession from "@/hooks/useAppSession";
import axiosInstance from "@/lib/axiosInstance";
import BoardFrame from "./BoardFrame";
import { relativeTime } from "@/lib/relativeTime";
import useTileDrag from "./useTileDrag";
import styles from "./index.module.css";

// Recent boards as frames on a canvas, in an order the user rearranges by dragging.

// [left %, top %, width px, height px, tilt deg] on a 1440 x 1000 board.
const SLOTS = [
    [26, 30, 380, 240, -0.6],
    [56, 36, 300, 190, 0.8],
    [80, 38, 230, 160, -1.2],
    [8, 60, 270, 180, 0.6],
    [33, 63, 250, 160, -0.4],
    [55, 64, 240, 150, 1],
    [75, 66, 220, 140, -0.8],
];
const WEEK_MS = 7 * 86400000;

function greeting(hour) {
    if (hour < 5) return "Still up";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

const readStorage = (key) => {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeStorage = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ordering is a convenience; a blocked storage just means recency order.
    }
};

const describeActivity = (item) =>
    item.kind === "comment" ? `${item.actor} commented on ${item.title || "a board"}.` : `${item.actor} shared ${item.title || "a board"} with you.`;

const shareIdFromLink = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
        return new URL(trimmed).searchParams.get("shareId");
    } catch {
        return /^[A-Za-z0-9_-]{6,}$/.test(trimmed) ? trimmed : null;
    }
};

const PlusIcon = ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const HomePage = ({ showToast }) => {
    const router = useRouter();
    const { session, isAuthenticated } = useAppSession();
    const userId = session?.user?.id;
    const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${session?.accessToken}` } }), [session?.accessToken]);

    const [boards, setBoards] = useState(null);
    const [order, setOrder] = useState(null);
    const [activity, setActivity] = useState([]);
    const [query, setQuery] = useState("");
    const [joinOpen, setJoinOpen] = useState(false);
    const [joinLink, setJoinLink] = useState("");
    const [creating, setCreating] = useState(false);
    const [hour] = useState(() => new Date().getHours());
    const boardRef = useRef(null);
    const fileInputRef = useRef(null);

    const orderKey = userId ? `mosaic:homeOrder:${userId}` : null;

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        let cancelled = false;
        axiosInstance
            .get("/api/drawing/get", authHeaders)
            .then(({ data }) => {
                if (!cancelled) setBoards([...data.data.ownedDrawings, ...data.data.sharedWithDrawings]);
            })
            .catch(() => {
                if (!cancelled) setBoards([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, authHeaders]);

    useEffect(() => {
        if (!orderKey) return;
        const stored = readStorage(orderKey);
        setOrder(stored ? JSON.parse(stored) : null);
    }, [orderKey]);

    // "Away" means since the last time this page was opened, or a week for a
    // first visit on this device.
    useEffect(() => {
        if (!isAuthenticated || !userId) return undefined;
        const visitKey = `mosaic:lastHomeVisit:${userId}`;
        const since = readStorage(visitKey) || new Date(Date.now() - WEEK_MS).toISOString();
        writeStorage(visitKey, new Date().toISOString());
        let cancelled = false;
        axiosInstance
            .get(`/api/drawing/activity?since=${encodeURIComponent(since)}`, authHeaders)
            .then(({ data }) => {
                if (!cancelled) setActivity(data.data);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, userId, authHeaders]);

    const ordered = useMemo(() => {
        if (!boards) return [];
        const stamp = (board) => new Date(board.updatedAt || board.createdAt || 0).getTime();
        const byRecency = [...boards].sort((left, right) => stamp(right) - stamp(left));
        if (!order) return byRecency;
        const rank = new Map(order.map((shareId, index) => [shareId, index]));
        const placed = byRecency.filter((board) => rank.has(board.shareId)).sort((a, b) => rank.get(a.shareId) - rank.get(b.shareId));
        return [...byRecency.filter((board) => !rank.has(board.shareId)), ...placed];
    }, [boards, order]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const matches = needle ? ordered.filter((board) => (board.title || "").toLowerCase().includes(needle)) : ordered;
        return matches.slice(0, SLOTS.length);
    }, [ordered, query]);

    const saveOrder = useCallback(
        (nextVisible) => {
            const rest = ordered.filter((board) => !nextVisible.includes(board));
            const next = [...nextVisible, ...rest].map((board) => board.shareId);
            setOrder(next);
            if (orderKey) writeStorage(orderKey, JSON.stringify(next));
        },
        [ordered, orderKey],
    );

    const moveBoard = useCallback(
        (from, step) => {
            const to = from + step;
            if (query || to < 0 || to >= visible.length) return;
            const next = [...visible];
            [next[from], next[to]] = [next[to], next[from]];
            saveOrder(next);
        },
        [query, visible, saveOrder],
    );

    const openBoard = useCallback((board) => router.push(`/?shareId=${board.shareId}`), [router]);

    const createBoard = async () => {
        if (creating) return;
        setCreating(true);
        try {
            const { data } = await axiosInstance.post("/api/drawing/create", { title: "Untitled board" }, authHeaders);
            router.push(`/?shareId=${data.data.shareId}`);
        } catch {
            showToast?.error("Couldn't create a board", "Check your connection and try again.");
            setCreating(false);
        }
    };

    const importBoard = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const parsed = parseSceneFile(await file.text());
        if (parsed.error) {
            showToast?.error("Couldn't import that file", SCENE_IMPORT_ERROR_MESSAGES[parsed.error]);
            return;
        }
        try {
            const title = file.name.replace(/\.[^.]+$/, "") || "Imported board";
            const { data } = await axiosInstance.post("/api/drawing/import", { title, scene: parsed.scene }, authHeaders);
            router.push(`/?shareId=${data.data.shareId}`);
        } catch {
            showToast?.error("Couldn't import that file", "The server refused it. Try exporting it again.");
        }
    };

    const joinBoard = (event) => {
        event.preventDefault();
        const shareId = shareIdFromLink(joinLink);
        if (!shareId) {
            showToast?.error("That isn't a board link", "Paste the full link someone shared with you.");
            return;
        }
        router.push(`/?shareId=${shareId}`);
    };

    const { dragHandlersFor, drag, hoverSlot } = useTileDrag({
        slots: SLOTS,
        count: visible?.length ?? 0,
        disabled: Boolean(query),
        boardRef,
        onSwap: (from, to) => moveBoard(from, to - from),
    });

    const username = session?.user?.username || session?.user?.name || "";
    const total = boards?.length ?? 0;

    return (
        <main id="main" className={styles.root}>
            <AppHeader crumbs={[{ label: "Home" }]} search={{ value: query, onChange: setQuery, placeholder: "Find a board" }} />

            <div className={styles.board} ref={boardRef}>
                <h1 className={styles.greeting}>
                    {greeting(hour)}, <em>{username}.</em>
                </h1>
                <p className={styles.subhead}>Your boards, laid out like a board. Drag them into the order you like.</p>

                <button type="button" className={styles.newTile} onClick={createBoard} disabled={creating}>
                    <span className={styles.frameTitle}>New board</span>
                    <span className={styles.newBox}>
                        <PlusIcon size={20} />
                        {creating ? "Creating" : "Blank canvas"}
                    </span>
                </button>

                {boards === null
                    ? SLOTS.slice(0, 4).map((slot) => (
                          <span
                              key={slot.join()}
                              className={`${styles.frame} ${styles.skeleton}`}
                              style={{
                                  "--left": `${slot[0]}%`,
                                  "--top": `${slot[1]}%`,
                                  "--width": `${slot[2]}px`,
                                  "--width-vw": `${(slot[2] / 1440) * 100}vw`,
                                  "--width-unitless": slot[2],
                                  "--ratio": `${slot[2]} / ${slot[3]}`,
                                  "--tilt": "0deg",
                              }}
                              aria-hidden="true"
                          />
                      ))
                    : visible.map((board, index) => (
                          <BoardFrame
                              key={board.shareId}
                              board={board}
                              slot={drag && hoverSlot === index && drag.index !== index ? SLOTS[drag.index] : SLOTS[index]}
                              index={index}
                              onOpen={openBoard}
                              onMove={moveBoard}
                              dragHandlers={dragHandlersFor(index)}
                              dragOffset={drag?.index === index ? drag : null}
                              makingRoom={drag && hoverSlot === index && drag.index !== index}
                          />
                      ))}

                {boards?.length === 0 && <p className={styles.emptyNote}>No boards yet. Start a blank canvas, or import a .mosaic or .json scene file.</p>}
                {boards && query && visible.length === 0 && (
                    <p className={styles.emptyNote}>No board titles match &ldquo;{query}&rdquo;. All boards also searches the words on them.</p>
                )}

                {activity.length > 0 && (
                    <aside className={styles.note} aria-label="While you were away">
                        <strong>While you were away</strong>
                        {activity.map((item) => (
                            <Link key={`${item.kind}-${item.shareId}-${item.at}`} href={`/?shareId=${item.shareId}`}>
                                {describeActivity(item)}
                            </Link>
                        ))}
                    </aside>
                )}
            </div>

            <nav className={styles.toolbar} aria-label="Board actions">
                {joinOpen ? (
                    <form className={styles.joinForm} onSubmit={joinBoard}>
                        <input
                            autoFocus
                            value={joinLink}
                            onChange={(event) => setJoinLink(event.target.value)}
                            placeholder="Paste a board link"
                            aria-label="Board link"
                            onKeyDown={(event) => event.key === "Escape" && setJoinOpen(false)}
                        />
                        <button type="submit" className={styles.primaryAction}>
                            Open
                        </button>
                        <button type="button" className={styles.action} onClick={() => setJoinOpen(false)}>
                            Cancel
                        </button>
                    </form>
                ) : (
                    <GlideMenu axis="x" className={styles.toolbarActions} highlightClassName={styles.toolbarGlide}>
                        <button type="button" className={styles.primaryAction} data-menu-row onClick={createBoard} disabled={creating}>
                            <PlusIcon />
                            New board
                        </button>
                        <button
                            type="button"
                            className={styles.action}
                            data-menu-row
                            title="Opens a board exported from Mosaic: a .mosaic or .json scene file"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Import
                            <span className={styles.fileHint}>.mosaic or .json</span>
                        </button>
                        <button type="button" className={styles.action} data-menu-row onClick={() => setJoinOpen(true)}>
                            Join with a link
                        </button>
                        <span className={styles.toolbarRule} aria-hidden="true" />
                        <Link href="/dashboard" className={styles.action} data-menu-row>
                            All boards
                        </Link>
                    </GlideMenu>
                )}
            </nav>
            <input ref={fileInputRef} type="file" accept=".mosaic,application/json" hidden onChange={importBoard} />
            <span className={styles.count}>
                {total} board{total === 1 ? "" : "s"} · {order ? "Your order" : "Recent first"}
            </span>
        </main>
    );
};

export default HomePage;
