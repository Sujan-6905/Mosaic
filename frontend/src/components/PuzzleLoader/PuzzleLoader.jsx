import { useEffect, useState } from "react";
import { isCalm } from "@/lib/calmMode";
import { LAST_TILE, MARK_TILES, PUZZLE_COLS, PUZZLE_SIZE, scramble, slide, solvedSlots } from "./slidingPuzzle";
import styles from "./PuzzleLoader.module.css";

const SCRAMBLE_MOVES = 16;
const SLIDE_MS = 150;
const REST_MS = 700;

// A loader that is a sliding puzzle solving itself into the Mosaic mark, scrambling again while the wait goes on.
export default function PuzzleLoader({ label }) {
    const [round, setRound] = useState(() => ({ slots: solvedSlots(), queue: [], complete: true }));

    useEffect(() => {
        if (isCalm()) return undefined;
        const timer = setTimeout(
            () => {
                setRound((current) => {
                    if (current.complete) {
                        const { slots, solution } = scramble(SCRAMBLE_MOVES);
                        return { slots, queue: solution, complete: false };
                    }
                    if (current.queue.length === 0) return { ...current, complete: true };
                    const [next, ...rest] = current.queue;
                    return { slots: slide(current.slots, next), queue: rest, complete: false };
                });
            },
            round.complete ? REST_MS : SLIDE_MS,
        );
        return () => clearTimeout(timer);
    }, [round]);

    const slotOf = new Map(round.slots.map((tile, slot) => [tile, slot]));
    return (
        <div className={styles.loader} role="status">
            <div className={styles.frame} aria-hidden="true">
                {Array.from({ length: PUZZLE_SIZE }, (_unused, tile) => {
                    const placed = tile === LAST_TILE ? round.complete : true;
                    const slot = tile === LAST_TILE ? LAST_TILE : slotOf.get(tile);
                    return (
                        <span
                            key={tile}
                            className={styles.tile}
                            data-gold={MARK_TILES.has(tile) || undefined}
                            data-placed={placed || undefined}
                            style={{ "--x": slot % PUZZLE_COLS, "--y": Math.floor(slot / PUZZLE_COLS) }}
                        />
                    );
                })}
            </div>
            <span className={styles.label}>{label}</span>
        </div>
    );
}
