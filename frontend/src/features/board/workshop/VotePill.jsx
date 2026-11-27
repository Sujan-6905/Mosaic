import { useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import styles from "./WorkshopBar.module.css";

const MAX_VOTES_EACH = 10;
const SHOWN_RESULTS = 3;

export const VoteSetup = ({ onStart, onClose }) => {
    const [votesEach, setVotesEach] = useState(3);
    return (
        <div className={styles.card} role="group" aria-label="Start a dot vote">
            <StrokeIcon name="vote" size={16} className={styles.cardIcon} />
            <span className={styles.cardLabel}>Votes each</span>
            <div className={styles.stepper}>
                <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setVotesEach((n) => Math.max(1, n - 1))}
                    disabled={votesEach <= 1}
                    aria-label="Fewer votes"
                >
                    <StrokeIcon name="minus" size={13} strokeWidth={2.4} />
                </button>
                <span className={styles.clock} aria-live="polite">
                    {votesEach}
                </span>
                <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setVotesEach((n) => Math.min(MAX_VOTES_EACH, n + 1))}
                    disabled={votesEach >= MAX_VOTES_EACH}
                    aria-label="More votes"
                >
                    <StrokeIcon name="insert" size={13} strokeWidth={2.4} />
                </button>
            </div>
            <button type="button" className={styles.primary} onClick={() => onStart(votesEach)}>
                Start vote
            </button>
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close vote setup">
                <StrokeIcon name="close" size={13} strokeWidth={2.4} />
            </button>
        </div>
    );
};

export const VotePill = ({ voting, myVotes, canVote, canControl, onChange, onShowElement, describeElement }) => {
    if (voting.status === "closed") {
        const top = (voting.results ?? []).slice(0, SHOWN_RESULTS);
        return (
            <div className={styles.pill} role="group" aria-label="Vote results">
                <StrokeIcon name="vote" size={14} className={styles.voteDot} />
                {top.length === 0 ? (
                    <span className={styles.status}>No votes were placed</span>
                ) : (
                    top.map(({ elementId, count }) => (
                        <button key={elementId} type="button" className={styles.result} onClick={() => onShowElement(elementId)} title="Show it on the board">
                            <span className={styles.resultCount}>{count}</span>
                            <span className={styles.resultLabel}>{describeElement(elementId)}</span>
                        </button>
                    ))
                )}
                {canControl && (
                    <button type="button" className={styles.iconButton} onClick={() => onChange("clear")} aria-label="Close the results">
                        <StrokeIcon name="close" size={13} strokeWidth={2.4} />
                    </button>
                )}
            </div>
        );
    }
    const left = voting.votesPerPerson - myVotes.length;
    return (
        <div className={styles.pill} role="status" aria-label="Dot vote in progress">
            <StrokeIcon name="vote" size={14} className={styles.voteDot} />
            <span className={styles.status}>{canVote ? (left > 0 ? `Click to vote: ${left} left` : "All your votes placed") : "Dot vote"}</span>
            <span className={styles.meta}>{voting.voterCount} voted</span>
            {canControl && (
                <button type="button" className={styles.textButton} onClick={() => onChange("end")}>
                    Reveal
                </button>
            )}
        </div>
    );
};
