import styles from "./PreviewSidePanels.module.css";

const Check = () => (
    <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5 12l5 5L20 7" />
    </svg>
);

export default function PreviewSidePanels() {
    return (
        <aside className={styles.side}>
            <section className={styles.assistant} data-part="side">
                <div className={styles.panelHead}>
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={styles.sparkle}
                    >
                        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
                    </svg>
                    <strong>Assistant</strong>
                </div>
                <p className={styles.userMessage}>Draft the signup flow right of Next, with email verification.</p>
                <ul className={styles.steps}>
                    <li>
                        <Check />
                        Read the board
                    </li>
                    <li>
                        <Check />
                        Laid out 5 shapes and 4 connectors
                    </li>
                </ul>
                <div className={styles.proposalCard}>
                    Proposed edit, placed inside the dashed frame.
                    <span className={styles.proposalActions}>
                        <span className={styles.apply}>Apply</span>
                        <span className={styles.ghostChip}>Review</span>
                    </span>
                </div>
                <span className={styles.composer}>Ask, or type / for commands</span>
            </section>
            <section className={styles.comments} data-part="side">
                <div className={styles.panelHead}>
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <strong>Comments</strong>
                    <span className={styles.panelMeta}>On &ldquo;Ship branching&rdquo;</span>
                </div>
                <p className={styles.comment}>
                    <span className={styles.commentAvatar} data-tone="sky">
                        AK
                    </span>
                    <span>
                        <strong>Akash</strong> Can branching ship before templates? <span className={styles.mention}>@Riya</span>
                    </span>
                </p>
                <p className={styles.comment}>
                    <span className={styles.commentAvatar} data-tone="gold">
                        SP
                    </span>
                    <span>
                        <strong>Riya</strong> Yes. Moved it to Now.
                    </span>
                </p>
                <span className={styles.replyRow}>
                    <span className={styles.reply}>Reply</span>
                    <span className={styles.ghostChip}>Resolve</span>
                </span>
            </section>
        </aside>
    );
}
