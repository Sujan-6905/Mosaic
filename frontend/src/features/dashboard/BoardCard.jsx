import { useRef, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { SweptPieces, SweptUndo } from "./SweptCard";
import { snapshotThumbnail } from "./sweptScene";
import BoardReel from "./BoardReel";
import styles from "./BoardCard.module.css";

function editedLabel(value) {
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return "Edited just now";
    if (minutes < 60) return `Edited ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Edited ${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (hours < 48) return "Edited yesterday";
    return `Edited ${new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

const peopleLabel = (board) => {
    const count = (board.collaborators?.length || 0) + 1;
    return count === 1 ? "Only you" : `${count} people`;
};

const StarIcon = ({ filled }) => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
);

const MoreIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
    </svg>
);

// The corner stone of a card, gilded while the board is starred.
function CornerTile({ starred, title, onToggle }) {
    const [gilding, setGilding] = useState(false);
    return (
        <button
            type="button"
            className={styles.corner}
            aria-pressed={starred}
            aria-label={starred ? `Remove ${title} from starred` : `Star ${title}`}
            data-gilding={gilding || undefined}
            onClick={() => {
                setGilding(true);
                onToggle();
            }}
            onAnimationEnd={(event) => event.animationName.includes("sheen") && setGilding(false)}
        >
            <span />
            <span />
            <span />
            <span />
        </button>
    );
}

export default function BoardCard({ board, isOwner, view, categories, actions }) {
    const href = `/?shareId=${board.shareId}`;
    const title = board.title || "Untitled board";
    const thumbRef = useRef(null);
    const piecesRef = useRef(null);
    const [swept, setSwept] = useState(null);

    const sweep = async () => {
        const snapshot = snapshotThumbnail(thumbRef.current);
        setSwept({ snapshot, restoring: false });
        if (!(await actions.sweep(board))) setSwept(null);
    };
    const putBack = async () => {
        setSwept((current) => ({ ...current, restoring: true }));
        if (await actions.restore(board)) piecesRef.current?.restore(() => setSwept(null));
        else setSwept((current) => ({ ...current, restoring: false }));
    };
    const undo = swept && !swept.restoring && <SweptUndo title={title} compact={view === "list"} onPutBack={putBack} onExpired={() => actions.settle(board)} />;
    const thumbnail = (width, height, className) => (
        <span ref={thumbRef} className={className}>
            {swept ? (
                <>
                    <SweptPieces ref={piecesRef} snapshot={swept.snapshot} />
                    {view === "grid" && <span className={styles.sweptOver}>{undo}</span>}
                </>
            ) : (
                <BoardReel board={board} loadReel={actions.loadReel} width={width} height={height} className={styles.reelFrame} />
            )}
        </span>
    );
    const otherCategories = categories.filter((category) => category._id !== board.categoryId);

    const menuItems = [
        { key: "open-tab", label: "Open in new tab", onSelect: () => window.open(href, "_blank", "noopener") },
        { key: "share", label: isOwner ? "Share" : "People with access", onSelect: () => actions.share(board, isOwner) },
        ...(isOwner ? [{ key: "rename", label: "Rename", onSelect: () => actions.rename(board) }] : []),
        { key: "star", label: board.favorite ? "Remove from starred" : "Add to starred", onSelect: () => actions.toggleStar(board) },
        ...(otherCategories.length || board.categoryId ? [{ divider: true }] : []),
        ...otherCategories.map((category) => ({
            key: `move-${category._id}`,
            label: `Move to ${category.name}`,
            onSelect: () => actions.move(board, category._id),
        })),
        ...(board.categoryId ? [{ key: "uncategorize", label: "Remove from category", onSelect: () => actions.move(board, null) }] : []),
        ...(isOwner ? [{ divider: true }, { key: "delete", label: "Delete board", destructive: true, onSelect: sweep }] : []),
    ];

    const menu = (
        <Dropdown
            align="end"
            trigger={
                <button type="button" className={styles.menuButton} aria-label={`Actions for ${title}`}>
                    <MoreIcon />
                </button>
            }
            items={menuItems}
        />
    );

    if (view === "list") {
        if (swept) {
            return (
                <div className={styles.row} data-swept>
                    <div className={styles.rowLink}>
                        {thumbnail(112, 76, styles.rowThumb)}
                        <span className={styles.rowSwept}>
                            <strong className={styles.rowTitle}>{title}</strong>
                            {undo}
                        </span>
                    </div>
                </div>
            );
        }
        return (
            <div className={styles.row}>
                <a href={href} className={styles.rowLink} onClick={(event) => actions.open(event, board)}>
                    {thumbnail(112, 76, styles.rowThumb)}
                    <strong className={styles.rowTitle}>{title}</strong>
                    <span className={styles.rowMeta}>{editedLabel(board.updatedAt || board.createdAt)}</span>
                    <span className={styles.rowMeta}>{peopleLabel(board)}</span>
                </a>
                <button
                    type="button"
                    className={styles.starButton}
                    data-on={!!board.favorite}
                    onClick={() => actions.toggleStar(board)}
                    aria-label={board.favorite ? `Remove ${title} from starred` : `Star ${title}`}
                    aria-pressed={!!board.favorite}
                >
                    <StarIcon filled={board.favorite} />
                </button>
                {menu}
            </div>
        );
    }

    if (swept) {
        return (
            <div className={styles.card} data-swept>
                <div className={styles.cardThumbLink}>{thumbnail(460, 260, styles.cardThumb)}</div>
                <div className={styles.cardFooter}>
                    <span className={styles.cardText}>
                        <strong>{title}</strong>
                        <span>{swept.restoring ? "Putting it back" : "Kept in Recently deleted for 30 days"}</span>
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <a href={href} className={styles.cardThumbLink} onClick={(event) => actions.open(event, board)} aria-label={`Open ${title}`}>
                {thumbnail(460, 260, styles.cardThumb)}
            </a>
            <CornerTile starred={!!board.favorite} title={title} onToggle={() => actions.toggleStar(board)} />
            <div className={styles.cardFooter}>
                <span className={styles.cardText}>
                    <strong>{title}</strong>
                    <span>{editedLabel(board.updatedAt || board.createdAt)}</span>
                </span>
                {menu}
            </div>
        </div>
    );
}
