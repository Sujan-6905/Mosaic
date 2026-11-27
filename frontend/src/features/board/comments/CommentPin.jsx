import { useRef, useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Popover from "@/components/ui/Popover";
import CommentMark from "./CommentMark.jsx";
import CommentThread from "./CommentThread.jsx";
import styles from "./CommentPin.module.css";
import cx from "clsx";

const DRAG_THRESHOLD = 4;

const initialsOf = (name) =>
    (name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");

// A fixed-size marker that never scales with zoom, so it stays legible.
// Its own pointer handlers decide open versus drag, so a drag never opens the thread.
const CommentPin = ({ comment, x, y, unread, isOpen, onOpenChange, collaborators, canComment, canManage, onReply, onToggleResolve, onDelete, onMoveTo }) => {
    const dragRef = useRef(null);
    const wrapperRef = useRef(null);
    const [dragOffset, setDragOffset] = useState(null);

    const canDrag = canManage && !!onMoveTo;

    const handlePointerDown = (e) => {
        e.stopPropagation();
        // The grip within the pin is kept, so its point lands where it's shown rather than jumping to the cursor.
        const tip = wrapperRef.current.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            gripX: e.clientX - tip.left,
            gripY: e.clientY - tip.top,
            moved: false,
            pointerId: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!dragRef.current || !canDrag) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        if (!dragRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            dragRef.current.moved = true;
        }
        if (dragRef.current.moved) setDragOffset({ dx, dy });
    };

    const handlePointerUp = (e) => {
        if (!dragRef.current) return;
        const { moved, pointerId, gripX, gripY } = dragRef.current;
        e.currentTarget.releasePointerCapture(pointerId);
        dragRef.current = null;
        setDragOffset(null);
        if (moved) {
            onMoveTo(e.clientX - gripX, e.clientY - gripY);
        } else {
            onOpenChange(!isOpen);
        }
    };

    const displayX = x + (dragOffset?.dx || 0);
    const displayY = y + (dragOffset?.dy || 0);

    return (
        <div ref={wrapperRef} className={styles.wrapper} style={{ left: displayX, top: displayY }}>
            <Popover
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                trigger={
                    <button
                        type="button"
                        data-comment-pin="true"
                        className={cx(styles.pin, {
                            [styles.resolved]: comment.resolved,
                            [styles.unread]: unread,
                            [styles.draggable]: canDrag,
                        })}
                        title={comment.resolved ? "Resolved comment" : canDrag ? "Comment (drag to move)" : "Comment"}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CommentMark>{comment.resolved ? <StrokeIcon name="check" size={13} strokeWidth={2.6} /> : initialsOf(comment.authorName)}</CommentMark>
                        {unread && <span className={styles.unreadDot} />}
                    </button>
                }
            >
                <CommentThread
                    comment={comment}
                    collaborators={collaborators}
                    canComment={canComment}
                    canManage={canManage}
                    onReply={onReply}
                    onToggleResolve={onToggleResolve}
                    onDelete={onDelete}
                    onClose={() => onOpenChange(false)}
                />
            </Popover>
        </div>
    );
};

export default CommentPin;
