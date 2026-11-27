import StaticCanvasPreview from "@/features/board/rendering/StaticCanvasPreview";
import shared from "./index.module.css";
import styles from "./BoardFrame.module.css";
import { relativeTime } from "@/lib/relativeTime";

// A native link drag would take over the pointer and end in pointercancel, so
// the anchor opts out of it: the tile only ever moves through the board's own drag.
export default function BoardFrame({ board, slot, index, onOpen, onMove, dragHandlers, dragOffset, makingRoom }) {
    const [left, top, width, height, tilt] = slot;
    const elements = board.previewElements || {};
    const isEmpty = Object.keys(elements).length === 0;

    return (
        <a
            href={`/?shareId=${board.shareId}`}
            className={`${shared.frame} ${styles.frame}`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            data-dragging={!!dragOffset}
            data-making-room={makingRoom || undefined}
            style={{
                translate: dragOffset ? `${dragOffset.dx}px ${dragOffset.dy}px` : undefined,
                "--left": `${left}%`,
                "--top": `${top}%`,
                "--width": `${width}px`,
                "--width-vw": `${(width / 1440) * 100}vw`,
                "--width-unitless": width,
                "--ratio": `${width} / ${height}`,
                "--tilt": `${tilt}deg`,
                "--order": index + 1,
            }}
            onClick={(event) => {
                event.preventDefault();
                onOpen(board);
            }}
            onKeyDown={(event) => {
                if (!event.altKey) return;
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") onMove(index, -1);
                else if (event.key === "ArrowRight" || event.key === "ArrowDown") onMove(index, 1);
                else return;
                event.preventDefault();
            }}
            aria-label={`${board.title || "Untitled board"}, edited ${relativeTime(board.updatedAt || board.createdAt)}. Alt and an arrow key moves it.`}
            {...dragHandlers}
        >
            <span className={styles.frameMeta}>
                <span className={styles.frameTitle}>{board.title || "Untitled board"}</span>
                <span>{relativeTime(board.updatedAt || board.createdAt)}</span>
            </span>
            <span className={styles.frameBox}>
                {isEmpty ? (
                    <span className={styles.emptyThumb}>Empty board</span>
                ) : (
                    <StaticCanvasPreview elements={elements} background={board.background} width={width * 2} height={height * 2} className={styles.thumb} />
                )}
            </span>
        </a>
    );
}
