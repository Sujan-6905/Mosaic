import SegmentedControl from "@/components/ui/SegmentedControl";
import StrokeIcon from "@/components/ui/StrokeIcon";
import { CHANGE_KIND_COLORS, RANGES, describeCatchUp, describeChange, describeChangeAuthors, describeSince } from "./catchUp";
import styles from "./CatchUpPanel.module.css";

// What changed on this board since someone was last here, and where to find it.
const CatchUpPanel = ({ catchUp, aiEnabled, onShowChange, onShowAll, onOpenComment }) => {
    const { isOpen, digest, range, loading, loadFailed, focusedChangeId, summary, close, chooseRange, setFocusedChangeId, summarize } = catchUp;
    if (!isOpen) return null;

    const changes = digest?.changes ?? [];
    const focusedIndex = changes.findIndex((change) => change.id === focusedChangeId);

    const focusChange = (change) => {
        setFocusedChangeId(change.id);
        onShowChange(change);
    };
    const step = (delta) => focusChange(changes[(focusedIndex + delta + changes.length) % changes.length]);

    return (
        <aside className={styles.panel} aria-label="Catch me up" data-board-chrome>
            <header className={styles.header}>
                <h2 className={styles.title}>While you were away</h2>
                <button type="button" className={styles.iconButton} aria-label="Close catch up" onClick={close}>
                    <StrokeIcon name="close" size={16} />
                </button>
            </header>

            <div className={styles.range} data-tour="catch-up-range">
                <SegmentedControl aria-label="Show changes since" options={RANGES} value={range} onChange={chooseRange} />
            </div>

            <div className={styles.body} data-tour="catch-up-body">
                {loading && <p className={styles.note}>Looking through the board&apos;s history…</p>}
                {!loading && loadFailed && <p className={styles.note}>Couldn&apos;t load what changed. Try another range or reopen this.</p>}
                {!loading && !loadFailed && !digest && <p className={styles.note}>Nothing new from anyone else in this time.</p>}

                {!loading && digest && (
                    <>
                        <p className={styles.headline} aria-live="polite">
                            <span className={styles.age}>{describeSince(digest.since)}</span>
                            {describeCatchUp(digest)}
                        </p>

                        {aiEnabled && summary.status !== "done" && (
                            <button type="button" className={styles.summarize} disabled={summary.status === "loading"} onClick={summarize}>
                                <StrokeIcon name="sparkle" size={14} />
                                {summary.status === "loading" ? "Summarising…" : "Summarise"}
                            </button>
                        )}
                        {summary.text && <p className={summary.status === "failed" ? styles.note : styles.summary}>{summary.text}</p>}

                        {digest.comments.length > 0 && (
                            <section aria-label="New comments">
                                <h3 className={styles.sectionTitle}>Comments</h3>
                                <ul className={styles.list}>
                                    {digest.comments.map((comment) => (
                                        <li key={`${comment.commentId}-${comment.at}`}>
                                            <button type="button" className={styles.row} onClick={() => onOpenComment(comment.commentId)}>
                                                <span className={styles.rowText}>
                                                    {comment.authorName}
                                                    {comment.mentionsYou ? " mentioned you" : comment.kind === "reply" ? " replied" : " commented"}
                                                </span>
                                                <span className={styles.rowDetail}>{comment.text}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {changes.length > 0 && (
                            <section aria-label="Changes">
                                <div className={styles.sectionHead}>
                                    <h3 className={styles.sectionTitle}>Changes</h3>
                                    <div className={styles.stepper}>
                                        <button type="button" className={styles.textButton} onClick={onShowAll}>
                                            Show all
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            aria-label="Previous change"
                                            onClick={() => step(focusedIndex < 0 ? 0 : -1)}
                                        >
                                            <StrokeIcon name="chevronLeft" size={16} />
                                        </button>
                                        <span className={styles.position}>
                                            {focusedIndex < 0 ? changes.length : `${focusedIndex + 1} of ${changes.length}`}
                                        </span>
                                        <button type="button" className={styles.iconButton} aria-label="Next change" onClick={() => step(1)}>
                                            <StrokeIcon name="chevronRight" size={16} />
                                        </button>
                                    </div>
                                </div>
                                <ul className={styles.list}>
                                    {changes.map((change) => (
                                        <li key={change.id}>
                                            <button
                                                type="button"
                                                className={styles.row}
                                                aria-current={change.id === focusedChangeId}
                                                onClick={() => focusChange(change)}
                                            >
                                                <span className={styles.rowText}>
                                                    <span
                                                        className={styles.kindDot}
                                                        style={{ background: CHANGE_KIND_COLORS[change.kind] }}
                                                        aria-hidden="true"
                                                    />
                                                    {describeChange(change)}
                                                </span>
                                                <span className={styles.rowDetail}>{describeChangeAuthors(change)}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {digest.moreChangeCount > 0 && <p className={styles.note}>And {digest.moreChangeCount} earlier.</p>}
                                {digest.truncated && <p className={styles.note}>That&apos;s a lot of activity, so this covers the most recent part.</p>}
                            </section>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};

export default CatchUpPanel;
