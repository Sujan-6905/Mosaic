import { useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Tabs from "@/components/ui/Tabs";
import { initialsOf } from "@/components/AppHeader";
import CommentThread from "./CommentThread";
import { isCommentUnreadFor, isCommentMine } from "./comments";
import styles from "./CommentsPanel.module.css";

const AVATAR_TONES = ["#8fb8ff", "#9fe0b4", "#d9c2ff", "#ffb3a7", "#ffd27a", "#9fd3ff"];
const toneFor = (name = "") => AVATAR_TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length];

function shortAge(value) {
    const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
    if (Number.isNaN(minutes)) return "";
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const anchorLabel = (comment, elements) => {
    const anchored = comment.elementId ? elements[comment.elementId] : null;
    return anchored?.text ? `On "${anchored.text.slice(0, 40)}"` : "On the board";
};

// The toggle lives in the board's top bar, beside presence.
const CommentsPanel = ({
    isOpen,
    onToggle,
    comments,
    elements,
    currentUserId,
    activeCommentId,
    onSelectComment,
    onNewComment,
    collaborators,
    canComment,
    canManageComment,
    onReply,
    onToggleResolve,
    onDelete,
    onCloseThread,
}) => {
    const [filter, setFilter] = useState("open");

    if (!isOpen) return null;

    const openCount = comments.filter((comment) => !comment.resolved).length;
    const filters = [
        { value: "open", label: openCount ? `Open (${openCount})` : "Open" },
        { value: "resolved", label: "Resolved" },
        { value: "mine", label: "Mine" },
    ];
    const filtered = comments.filter((comment) => {
        if (filter === "open") return !comment.resolved;
        if (filter === "resolved") return comment.resolved;
        return isCommentMine(comment, currentUserId);
    });

    return (
        <aside className={styles.panel} aria-label="Comments" data-board-chrome>
            <div className={styles.header}>
                <h2 className={styles.title}>Comments</h2>
                {canComment && (
                    <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="New comment: click anywhere on the board"
                        title="New comment"
                        onClick={onNewComment}
                    >
                        <StrokeIcon name="plus" size={16} />
                    </button>
                )}
                <button type="button" className={styles.iconButton} aria-label="Close comments panel" onClick={onToggle}>
                    <StrokeIcon name="close" size={14} strokeWidth={2.4} />
                </button>
            </div>
            <div className={styles.tabs}>
                <Tabs tabs={filters} value={filter} onChange={setFilter} ariaLabel="Filter comments" />
            </div>
            <div className={styles.list}>
                {filtered.length === 0 && (
                    <p className={styles.empty}>
                        {filter === "open" ? "Nothing open. Pick Comment on the dock, then click the board to start a thread." : "Nothing here yet."}
                    </p>
                )}
                {filtered.map((comment) => {
                    if (comment._id === activeCommentId) {
                        const manageable = canManageComment(comment);
                        return (
                            <div key={comment._id} className={styles.activeThread}>
                                <span className={styles.anchor}>{anchorLabel(comment, elements)}</span>
                                <CommentThread
                                    comment={comment}
                                    collaborators={collaborators}
                                    canComment={canComment}
                                    canManage={manageable}
                                    onReply={(text, mentions) => onReply(comment._id, text, mentions)}
                                    onToggleResolve={(resolved) => onToggleResolve(comment._id, resolved)}
                                    onDelete={manageable ? () => onDelete(comment._id) : undefined}
                                    onClose={onCloseThread}
                                />
                            </div>
                        );
                    }
                    const replies = comment.replies?.length || 0;
                    return (
                        <button key={comment._id} type="button" className={styles.item} onClick={() => onSelectComment(comment)}>
                            <span className={styles.avatar} style={{ background: toneFor(comment.authorName) }}>
                                {initialsOf(comment.authorName)}
                            </span>
                            <span className={styles.itemBody}>
                                <span className={styles.itemHeader}>
                                    <strong>{comment.authorName}</strong>
                                    <span>{shortAge(comment.createdAt)}</span>
                                </span>
                                <span className={styles.itemPreview}>{comment.text}</span>
                                <span className={styles.itemMeta}>
                                    {anchorLabel(comment, elements)}
                                    {replies > 0 ? ` · ${replies} repl${replies === 1 ? "y" : "ies"}` : ""}
                                    {comment.resolved ? " · Resolved" : ""}
                                </span>
                            </span>
                            {isCommentUnreadFor(comment, currentUserId) && <span className={styles.unreadDot} aria-label="Unread" />}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};

export default CommentsPanel;
