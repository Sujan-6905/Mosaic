import { useState } from "react";
import { getElementBounds } from "../../../../shared/canvas/geometry/bounds.js";
import StrokeIcon from "@/components/ui/StrokeIcon";
import styles from "./Embed.module.css";

const anchorPoint = (anchor, elements) => {
    if (anchor?.type === "point") return { x: anchor.x, y: anchor.y };
    const bounds = getElementBounds(elements?.[anchor?.elementId]);
    return bounds ? { x: bounds.maxX, y: bounds.minY } : null;
};

// Open threads pinned where they belong; a signed-in commenter drops a new one
// by choosing "Comment" and clicking the spot.
export default function EmbedComments({ comments, canComment, onAdd, camera, elements }) {
    const [placing, setPlacing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [openId, setOpenId] = useState(null);
    const open = comments.filter((comment) => !comment.resolved);

    const submit = (event) => {
        event.preventDefault();
        const text = draft?.text.trim();
        if (text) onAdd({ type: "point", x: draft.point.x, y: draft.point.y }, text);
        setDraft(null);
    };

    return (
        <>
            {placing && (
                <div
                    className={styles.placingLayer}
                    onClick={(event) => {
                        const point = camera.worldPointOf(event);
                        if (point) setDraft({ point, text: "" });
                        setPlacing(false);
                    }}
                    aria-hidden="true"
                />
            )}
            {open.map((comment) => {
                const at = camera.screenPointOf(anchorPoint(comment.anchor, elements) ?? { x: 0, y: 0 });
                if (!at) return null;
                return (
                    <div key={comment._id} className={styles.pin} style={{ left: at.left, top: at.top }}>
                        <button
                            type="button"
                            className={styles.pinMark}
                            aria-expanded={openId === comment._id}
                            aria-label={`Comment by ${comment.authorName ?? "someone"}`}
                            onClick={() => setOpenId(openId === comment._id ? null : comment._id)}
                        >
                            <StrokeIcon name="comment" size={13} />
                        </button>
                        {openId === comment._id && (
                            <div className={styles.thread}>
                                <p>
                                    <strong>{comment.authorName ?? "Someone"}</strong> {comment.text}
                                </p>
                                {(comment.replies ?? []).map((reply) => (
                                    <p key={reply._id}>
                                        <strong>{reply.authorName ?? "Someone"}</strong> {reply.text}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
            {draft && (
                <form className={styles.pin} style={camera.screenPointOf(draft.point) ?? {}} onSubmit={submit}>
                    <div className={styles.thread}>
                        <textarea
                            className={styles.commentInput}
                            autoFocus
                            rows={3}
                            maxLength={2000}
                            aria-label="Comment"
                            value={draft.text}
                            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                        />
                        <div className={styles.threadActions}>
                            <button type="button" className={styles.tool} onClick={() => setDraft(null)}>
                                Cancel
                            </button>
                            <button type="submit" className={styles.primary}>
                                Post
                            </button>
                        </div>
                    </div>
                </form>
            )}
            {canComment && (
                <button type="button" className={styles.commentToggle} aria-pressed={placing} onClick={() => setPlacing((value) => !value)}>
                    <StrokeIcon name="comment" size={15} /> {placing ? "Click to place" : "Comment"}
                </button>
            )}
        </>
    );
}
