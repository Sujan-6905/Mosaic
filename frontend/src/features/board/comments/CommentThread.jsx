import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faRotateLeft, faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";
import Avatar from "@/components/ui/Avatar";
import IconButton from "@/components/ui/IconButton";
import CommentComposer from "./CommentComposer.jsx";
import { splitMentionSegments } from "./comments";
import styles from "./CommentThread.module.css";

const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const MentionText = ({ text, usernames }) => (
    <>
        {splitMentionSegments(text, usernames).map((segment, i) =>
            segment.isMention ? (
                <span key={i} className={styles.mention}>
                    {segment.text}
                </span>
            ) : (
                <span key={i}>{segment.text}</span>
            ),
        )}
    </>
);

const Message = ({ authorName, text, createdAt, usernames }) => (
    <div className={styles.message}>
        <Avatar name={authorName} size="sm" />
        <div className={styles.messageBody}>
            <div className={styles.messageHeader}>
                <span className={styles.author}>{authorName}</span>
                <span className={styles.timestamp}>{formatTime(createdAt)}</span>
            </div>
            <p className={styles.text}>
                <MentionText text={text} usernames={usernames} />
            </p>
        </div>
    </div>
);

// Resolving hides a thread but keeps it. Deleting is for the author or owner, armed by one click
// and applied by a second, so it is never one slip away.
const CommentThread = ({ comment, collaborators, canComment, canManage, onReply, onToggleResolve, onDelete, onClose }) => {
    const usernames = collaborators.map((c) => c.username);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const handleDeleteClick = () => {
        if (!confirmingDelete) {
            setConfirmingDelete(true);
            return;
        }
        onDelete?.();
    };

    return (
        <div className={styles.thread}>
            <div className={styles.header}>
                <span className={styles.title}>{comment.resolved ? "Resolved thread" : "Comment"}</span>
                <div className={styles.headerActions}>
                    {canComment && (
                        <IconButton
                            size="sm"
                            aria-label={comment.resolved ? "Reopen thread" : "Resolve thread"}
                            title={comment.resolved ? "Reopen thread" : "Resolve thread"}
                            onClick={() => onToggleResolve(!comment.resolved)}
                        >
                            <FontAwesomeIcon icon={comment.resolved ? faRotateLeft : faCheck} />
                        </IconButton>
                    )}
                    {canManage && onDelete && (
                        <IconButton
                            size="sm"
                            className={confirmingDelete ? styles.confirmDelete : undefined}
                            aria-label={confirmingDelete ? "Confirm delete comment" : "Delete comment"}
                            title={confirmingDelete ? "Click again to permanently delete" : "Delete comment"}
                            onClick={handleDeleteClick}
                            onBlur={() => setConfirmingDelete(false)}
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </IconButton>
                    )}
                    <IconButton size="sm" aria-label="Close" onClick={onClose}>
                        <FontAwesomeIcon icon={faTimes} />
                    </IconButton>
                </div>
            </div>
            <div className={styles.messages}>
                <Message authorName={comment.authorName} text={comment.text} createdAt={comment.createdAt} usernames={usernames} />
                {(comment.replies || []).map((reply) => (
                    <Message key={reply.id} authorName={reply.authorName} text={reply.text} createdAt={reply.createdAt} usernames={usernames} />
                ))}
            </div>
            {canComment && <CommentComposer collaborators={collaborators} placeholder="Reply…" onSubmit={onReply} />}
        </div>
    );
};

export default CommentThread;
