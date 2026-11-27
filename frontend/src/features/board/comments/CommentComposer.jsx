import { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import IconButton from "@/components/ui/IconButton";
import Avatar from "@/components/ui/Avatar";
import { findActiveMentionQuery, insertMention, extractMentionedUserIds } from "./comments";
import styles from "./CommentComposer.module.css";

// @ opens autocomplete over this board's collaborators only, so it can't reveal other accounts.
// On submit, @username tokens resolve to user ids for the server to notify.
const CommentComposer = ({ collaborators, onSubmit, placeholder = "Add a comment…", autoFocus = false }) => {
    const [text, setText] = useState("");
    const [activeMention, setActiveMention] = useState(null);
    const textareaRef = useRef(null);

    const updateActiveMention = (value, caretIndex) => {
        setActiveMention(findActiveMentionQuery(value, caretIndex));
    };

    const handleChange = (e) => {
        setText(e.target.value);
        updateActiveMention(e.target.value, e.target.selectionStart);
    };

    const handleSelectMention = (username) => {
        const { text: nextText, caretIndex } = insertMention(text, activeMention, username);
        setText(nextText);
        setActiveMention(null);
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(caretIndex, caretIndex);
        });
    };

    const submit = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSubmit(trimmed, extractMentionedUserIds(trimmed, collaborators));
        setText("");
        setActiveMention(null);
    };

    const handleKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey && !activeMention) {
            e.preventDefault();
            submit();
        } else if (e.key === "Escape") {
            setActiveMention(null);
        }
    };

    const suggestions = activeMention ? collaborators.filter((c) => c.username.toLowerCase().startsWith(activeMention.query.toLowerCase())).slice(0, 6) : [];

    return (
        <div className={styles.wrapper}>
            {activeMention && suggestions.length > 0 && (
                <ul className={styles.mentionList} onPointerDown={(e) => e.preventDefault()}>
                    {suggestions.map((c) => (
                        <li key={c.userId}>
                            <button type="button" className={styles.mentionOption} onClick={() => handleSelectMention(c.username)}>
                                <Avatar name={c.username} size="sm" />
                                <span>{c.username}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <textarea
                ref={textareaRef}
                className={styles.textarea}
                rows={2}
                autoFocus={autoFocus}
                placeholder={placeholder}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                maxLength={2000}
            />
            <IconButton size="sm" aria-label="Send" title="Send (Enter)" onClick={submit} disabled={!text.trim()}>
                <FontAwesomeIcon icon={faPaperPlane} />
            </IconButton>
        </div>
    );
};

export default CommentComposer;
