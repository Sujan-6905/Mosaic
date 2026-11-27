import { useEffect } from "react";
import { worldToScreen } from "../camera/camera";
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import styles from "./VoteBadges.module.css";
import { playSound } from "@/lib/soundKit";

const MAX_DOTS = 5;
const TURN_STEP_MS = 140;
const TURN_SPREAD_MS = 1400;

const countsOf = (elementIds) => {
    const counts = new Map();
    elementIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    return counts;
};

// Your own votes while a vote is open, each a dot you can click to take back;
// everyone's totals once it is revealed.
const VoteBadges = ({ elements, camera, voting, myVotes, onTakeBack }) => {
    const revealed = voting?.status === "closed";
    const resultCount = voting?.results?.length ?? 0;
    useEffect(() => {
        if (!revealed) return undefined;
        const timer = setTimeout(() => playSound("chime"), Math.min(TURN_STEP_MS * resultCount, TURN_SPREAD_MS));
        return () => clearTimeout(timer);
    }, [revealed, resultCount]);
    if (!voting) return null;
    const counts = revealed ? new Map((voting.results ?? []).map(({ elementId, count }) => [elementId, count])) : countsOf(myVotes);
    // Totals turn over from fewest to most, so the room reads the result building up to the winner.
    const order = [...counts].sort((a, b) => a[1] - b[1]).map(([elementId]) => elementId);
    const step = Math.min(TURN_STEP_MS, TURN_SPREAD_MS / Math.max(1, order.length));
    const top = Math.max(0, ...counts.values());
    return (
        <div className={styles.layer} data-board-chrome>
            {[...counts].map(([elementId, count]) => {
                const bounds = getElementBounds(elements[elementId]);
                if (!bounds) return null;
                const at = worldToScreen(camera, bounds.maxX, bounds.minY);
                const style = { left: at.x, top: at.y };
                if (revealed) {
                    return (
                        <span
                            key={elementId}
                            className={styles.total}
                            data-winner={count === top}
                            style={{ ...style, "--turn-delay": `${order.indexOf(elementId) * step}ms` }}
                            aria-label={`${count} ${count === 1 ? "vote" : "votes"}`}
                        >
                            <span className={styles.face} aria-hidden="true" />
                            <span className={styles.count}>{count}</span>
                        </span>
                    );
                }
                return (
                    <button
                        key={elementId}
                        type="button"
                        className={styles.mine}
                        style={style}
                        onClick={() => onTakeBack(elementId)}
                        aria-label={`Your ${count === 1 ? "vote" : `${count} votes`} here. Take one back`}
                        title="Take a vote back"
                    >
                        {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
                            <span key={i} className={styles.dot} />
                        ))}
                        {count > MAX_DOTS && <span className={styles.more}>+{count - MAX_DOTS}</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default VoteBadges;
