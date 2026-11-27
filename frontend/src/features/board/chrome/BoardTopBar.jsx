import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosInstance";
import Dropdown from "@/components/ui/Dropdown";
import Tooltip from "@/components/ui/Tooltip";
import BrandTiles from "@/components/BrandTiles";
import StrokeIcon from "@/components/ui/StrokeIcon";
import ShareAccessModal from "@/features/sharing/ShareAccessModal";
import NotificationBell from "@/features/notifications/NotificationBell";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { initialsOf } from "@/components/AppHeader";
import { useTheme } from "@/theme/ThemeProvider";
import useMediaQuery from "@/hooks/useMediaQuery";
import BottomSheet from "@/components/ui/BottomSheet";
import useCompactBoard from "./useCompactBoard";
import { asDropdown, fileItems, historyItems, sessionItems, shareItems } from "./boardMenus";
import { socket } from "@/lib/socket.js";
import styles from "./BoardTopBar.module.css";
import { signOutOfMosaic } from "@/lib/signOutOfMosaic";
import { SWEPT_BOARD_DAYS } from "../../../../../shared/rules/sweptBoards.js";
import LetterDialog from "../sharing/LetterDialog";

const VISIBLE_PEOPLE = 4;

function statusOf({ isConnected, saveStatus }) {
    if (!isConnected) return { label: "Offline", tone: "offline", detail: "Disconnected. Changes aren't syncing." };
    if (saveStatus === "saving") return { label: "Saving", tone: "saving", detail: "Saving your changes" };
    return { label: "Saved", tone: "saved", detail: "All changes saved" };
}

// The title and board menu on the left; presence, comments, history, Present and Share on the right. On a phone
// the right side keeps only notifications, Share and the account, and the board menu opens as a sheet with the rest.
export default function BoardTopBar({
    shareId,
    session,
    role,
    showToast,
    isConnected,
    saveStatus,
    participants,
    presentingSocketIds,
    followingSocketId,
    onToggleFollow,
    agentActivityByUserId,
    isPresenting,
    onTogglePresent,
    commentsPanelOpen,
    shareOpenRequested = false,
    unreadCommentCount,
    onToggleComments,
    catchUpOpen,
    onToggleCatchUp,
    historyOpen,
    onToggleHistory,
    actions,
    onToggleBackground,
    onToggleMinimap,
    onTitleChange,
}) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const isTablet = useMediaQuery("(max-width: 1024px)");
    const compact = useCompactBoard();
    const token = session?.accessToken;
    const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const [board, setBoard] = useState(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [titleDraft, setTitleDraft] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [lettersOpen, setLettersOpen] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    useEffect(() => setShareOpen(shareOpenRequested), [shareOpenRequested]);

    const isOwner = role === "owner";
    const canRename = role === "owner" || role === "editor";

    useEffect(() => {
        if (!shareId || !token) return;
        axiosInstance
            .get(`/api/drawing/getById/${shareId}`, authHeaders)
            .then(({ data }) => setBoard({ id: data.data._id, title: data.data.title || "Untitled board" }))
            .catch(() => {});
        axiosInstance
            .get(`/api/organization/boards/${shareId}`, authHeaders)
            .then(({ data }) => setIsFavorite(Boolean(data.favorite)))
            .catch(() => {});
    }, [shareId, token, authHeaders]);

    useEffect(() => {
        if (!board?.title) return;
        document.title = `${board.title} · Mosaic`;
        onTitleChange?.(board.title);
    }, [board?.title, onTitleChange]);

    const deleteBoard = async () => {
        try {
            await axiosInstance.delete(`/api/drawing/delete/${board.id}`, authHeaders);
            showToast?.success("Board deleted", `Put "${board.title}" back from Recently deleted within ${SWEPT_BOARD_DAYS} days.`);
            router.push("/dashboard");
        } catch (error) {
            setDeleteOpen(false);
            showToast?.error("Couldn't delete the board", error.response?.data?.message || "Try again in a moment.");
        }
    };

    const saveTitle = async () => {
        const next = titleDraft?.trim();
        setTitleDraft(null);
        if (!next || !board || next === board.title) return;
        const previous = board.title;
        setBoard({ ...board, title: next });
        try {
            await axiosInstance.put(`/api/drawing/update/${board.id}`, { newTitle: next }, authHeaders);
        } catch (error) {
            setBoard((current) => ({ ...current, title: previous }));
            showToast?.error("Couldn't rename the board", error.response?.data?.message || "Try again in a moment.");
        }
    };

    const toggleFavorite = async () => {
        const next = !isFavorite;
        setIsFavorite(next);
        try {
            await axiosInstance.put(`/api/organization/boards/${shareId}`, { favorite: next }, authHeaders);
        } catch {
            setIsFavorite(!next);
            showToast?.error("Couldn't update starred", "Try again in a moment.");
        }
    };

    const status = statusOf({ isConnected, saveStatus });
    const others = participants.filter((participant) => participant.socketId !== socket.id);
    const presenter = participants.find((participant) => presentingSocketIds?.has(participant.socketId));
    const username = session?.user?.username || session?.user?.name || "";

    const files = fileItems({
        canRename,
        isFavorite,
        onRename: () => setTitleDraft(board?.title || ""),
        onToggleStar: toggleFavorite,
        actions,
        onDelete: isOwner && board?.id ? () => setDeleteOpen(true) : null,
    });
    const history = historyItems({ actions, onToggleHistory, onToggleCatchUp, historyOpen, catchUpOpen });
    const sharing = shareItems({ isOwner, actions, onPeople: () => setShareOpen(true), onLetter: () => setLettersOpen(true) });
    const facilitation = sessionItems({ actions, isPresenting, onTogglePresent, includePresent: isTablet || compact });
    const sheetSections = [
        {
            title: "On this board",
            items: [
                {
                    key: "comments",
                    label: "Comments",
                    icon: "comment",
                    active: commentsPanelOpen,
                    badge: unreadCommentCount ? String(unreadCommentCount) : null,
                    onSelect: onToggleComments,
                },
                ...history,
            ],
        },
        { title: "Share", items: sharing },
        { title: "Run a session", items: facilitation },
        {
            title: "View",
            items: [
                { key: "fit", label: "Zoom to fit", icon: "fit", onSelect: actions.zoomToFit },
                { key: "background", label: "Background", icon: "grid", onSelect: onToggleBackground },
                { key: "minimap", label: "Minimap", icon: "map", onSelect: onToggleMinimap },
                { key: "help", label: "Help", icon: "help", onSelect: actions.openHelp },
            ],
        },
        { title: "Board", items: [...files.about, ...files.file, ...files.danger] },
    ];

    return (
        <>
            <header className={styles.bar} data-board-chrome>
                <div className={styles.titlePill}>
                    <Tooltip label="All boards" side="bottom">
                        <button type="button" className={styles.mark} aria-label="Back to all boards" onClick={() => router.push("/dashboard")}>
                            <BrandTiles />
                        </button>
                    </Tooltip>
                    {titleDraft !== null ? (
                        <input
                            className={styles.titleInput}
                            value={titleDraft}
                            autoFocus
                            maxLength={100}
                            aria-label="Board name"
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                                if (event.key === "Escape") setTitleDraft(null);
                            }}
                        />
                    ) : null}
                    {titleDraft !== null ? (
                        <span className={styles.renameHint}>Enter to save, Esc to cancel</span>
                    ) : (
                        <button
                            type="button"
                            className={styles.title}
                            onDoubleClick={() => canRename && setTitleDraft(board?.title || "")}
                            title={canRename ? "Double-click to rename" : undefined}
                        >
                            {board?.title || " "}
                        </button>
                    )}
                    {isFavorite && titleDraft === null && (
                        <span className={styles.star} aria-label="Starred">
                            <StrokeIcon name="star" size={13} fill="currentColor" />
                        </span>
                    )}
                    {compact ? (
                        <button type="button" className={styles.iconButton} aria-label="Board menu" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
                            <StrokeIcon name="chevronDown" size={12} strokeWidth={2.6} />
                        </button>
                    ) : (
                        <Dropdown
                            align="start"
                            trigger={
                                <button type="button" className={styles.iconButton} aria-label="Board menu">
                                    <StrokeIcon name="chevronDown" size={12} strokeWidth={2.6} />
                                </button>
                            }
                            items={asDropdown(files.about, files.file, files.danger)}
                        />
                    )}
                    <Tooltip label={status.detail} side="bottom">
                        <span className={styles.status} data-tone={status.tone} role="status">
                            {status.tone === "offline" && <span className={styles.statusDot} />}
                            {status.label}
                        </span>
                    </Tooltip>
                </div>

                <div className={styles.actionsPill}>
                    {others.length > 0 && (
                        <span className={styles.people}>
                            {others.slice(0, VISIBLE_PEOPLE).map((participant) => {
                                const isFollowed = followingSocketId === participant.socketId;
                                const isPresenter = presentingSocketIds?.has(participant.socketId);
                                const agent = agentActivityByUserId?.get(participant.userId);
                                const viaMcp = participant.via === "mcp";
                                const label = agent
                                    ? `${participant.name}: AI assistant ${agent.label}`
                                    : viaMcp
                                      ? `${participant.name}, an agent connected through MCP`
                                      : isFollowed
                                        ? `Following ${participant.name}. Click to stop.`
                                        : `${participant.name}${isPresenter ? " is presenting" : ""}. Click to follow.`;
                                return (
                                    <Tooltip key={participant.socketId} label={label} side="bottom">
                                        <button
                                            type="button"
                                            className={styles.avatar}
                                            data-followed={isFollowed}
                                            data-presenting={isPresenter}
                                            style={{ background: participant.color }}
                                            onClick={() => onToggleFollow?.(participant.socketId)}
                                            aria-label={label}
                                        >
                                            {initialsOf(participant.name)}
                                            {(agent || viaMcp) && (
                                                <span className={styles.agentBadge}>
                                                    <StrokeIcon name="sparkle" size={9} strokeWidth={3} />
                                                </span>
                                            )}
                                        </button>
                                    </Tooltip>
                                );
                            })}
                            {others.length > VISIBLE_PEOPLE && <span className={styles.more}>+{others.length - VISIBLE_PEOPLE}</span>}
                        </span>
                    )}
                    <Tooltip label="Comments" side="bottom">
                        <button
                            type="button"
                            className={styles.iconButton}
                            aria-pressed={commentsPanelOpen}
                            aria-label={unreadCommentCount ? `Comments, ${unreadCommentCount} unread` : "Comments"}
                            onClick={onToggleComments}
                        >
                            <StrokeIcon name="comment" />
                            {unreadCommentCount > 0 && <span className={styles.badge}>{unreadCommentCount > 9 ? "9+" : unreadCommentCount}</span>}
                        </button>
                    </Tooltip>
                    <Tooltip label="Notifications" side="bottom">
                        <NotificationBell token={token} className={`${styles.iconButton} ${styles.keepCompact}`} showToast={showToast} />
                    </Tooltip>
                    <Dropdown
                        align="end"
                        trigger={
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label="History"
                                title="History"
                                data-active={historyOpen || catchUpOpen || undefined}
                                data-tour="history-menu"
                            >
                                <StrokeIcon name="history" />
                            </button>
                        }
                        items={asDropdown(history)}
                    />
                    <button
                        type="button"
                        className={styles.textButton}
                        data-tour="present"
                        aria-pressed={isPresenting}
                        onClick={onTogglePresent}
                        title={isPresenting ? "Stop presenting" : presenter ? `${presenter.name} is presenting` : "Present your view to the room"}
                    >
                        {isPresenting ? "Presenting" : "Present"}
                    </button>
                    <Dropdown
                        align="end"
                        trigger={
                            <button type="button" className={styles.share} data-tour="share-button" aria-label="Share">
                                {compact ? <StrokeIcon name="share" size={16} /> : "Share"}
                            </button>
                        }
                        items={asDropdown(sharing, facilitation)}
                    />
                    <Dropdown
                        align="end"
                        trigger={
                            <button type="button" className={styles.account} aria-label={`Account menu for ${username}`}>
                                {initialsOf(username)}
                            </button>
                        }
                        header={
                            <div className={styles.menuHeader}>
                                <strong>@{username}</strong>
                                <span>{role ? `${role[0].toUpperCase()}${role.slice(1)} on this board` : "Joining"}</span>
                            </div>
                        }
                        items={[
                            { key: "home", label: "Home", onSelect: () => router.push("/") },
                            { key: "boards", label: "All boards", onSelect: () => router.push("/dashboard") },
                            { key: "profile", label: "Profile", onSelect: () => router.push("/profile") },
                            { key: "help", label: "Help and resources", onSelect: actions.openHelp },
                            {
                                key: "theme",
                                label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
                                onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
                            },
                            { divider: true },
                            { key: "signout", label: "Sign out", dangerOnHover: true, onSelect: () => signOutOfMosaic({ callbackUrl: "/" }) },
                        ]}
                    />
                </div>
            </header>

            {compact && <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={board?.title || "Board"} sections={sheetSections} />}

            <ShareAccessModal
                isOpen={shareOpen}
                onClose={() => setShareOpen(false)}
                shareId={shareId}
                boardTitle={board?.title}
                isOwner={isOwner}
                showToast={showToast}
                live
            />

            {isOwner && <LetterDialog isOpen={lettersOpen} onClose={() => setLettersOpen(false)} shareId={shareId} token={token} showToast={showToast} />}

            <Modal
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={`Delete "${board?.title || "Untitled board"}"?`}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                            Keep it
                        </Button>
                        <Button variant="danger" onClick={deleteBoard}>
                            Delete board
                        </Button>
                    </>
                }
            >
                <p className={styles.dialogText}>
                    It&apos;s removed for everyone it&apos;s shared with. You can put it back from Recently deleted on your boards for {SWEPT_BOARD_DAYS} days.
                </p>
            </Modal>
        </>
    );
}
