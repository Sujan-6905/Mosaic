import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import StaticCanvasPreview from "@/features/board/rendering/StaticCanvasPreview";
import { SWEPT_BOARD_DAYS } from "../../../../shared/rules/sweptBoards.js";
import cardStyles from "./BoardCard.module.css";
import styles from "./index.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysLeft = (deletedAt) => Math.max(1, Math.ceil(SWEPT_BOARD_DAYS - (Date.now() - new Date(deletedAt).getTime()) / DAY_MS));

// Boards the owner swept away, each kept until its grace period runs out.
export default function SweptBoards({ boards, onRestore, onPurge }) {
    const [purging, setPurging] = useState(null);

    if (boards.length === 0) {
        return <p className={styles.emptyGroup}>Nothing here. Boards you delete stay for {SWEPT_BOARD_DAYS} days, so you can put them back.</p>;
    }

    return (
        <>
            <div className={styles.list}>
                {boards.map((board) => {
                    const title = board.title || "Untitled board";
                    const left = daysLeft(board.deletedAt);
                    return (
                        <div key={board.shareId} className={cardStyles.row}>
                            <span className={cardStyles.rowLink}>
                                <span className={cardStyles.rowThumb}>
                                    {Object.keys(board.previewElements || {}).length > 0 && (
                                        <StaticCanvasPreview
                                            elements={board.previewElements}
                                            background={board.background}
                                            width={112}
                                            height={76}
                                            className={cardStyles.thumbCanvas}
                                        />
                                    )}
                                </span>
                                <strong className={cardStyles.rowTitle}>{title}</strong>
                                <span className={cardStyles.rowMeta}>
                                    Gone for good in {left} day{left === 1 ? "" : "s"}
                                </span>
                            </span>
                            <Button size="sm" variant="secondary" onClick={() => onRestore(board)} aria-label={`Put ${title} back`}>
                                Put it back
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setPurging(board)} aria-label={`Delete ${title} for good`}>
                                Delete for good
                            </Button>
                        </div>
                    );
                })}
            </div>
            <Modal
                isOpen={!!purging}
                onClose={() => setPurging(null)}
                title={`Delete "${purging?.title || "Untitled board"}" for good?`}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setPurging(null)}>
                            Keep it
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => {
                                onPurge(purging);
                                setPurging(null);
                            }}
                        >
                            Delete for good
                        </Button>
                    </>
                }
            >
                <p className={styles.dialogText}>Its history, comments and conversations go with it. This one can&apos;t be undone.</p>
            </Modal>
        </>
    );
}
