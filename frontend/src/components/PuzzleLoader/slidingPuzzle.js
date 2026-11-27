// A 4 by 3 sliding puzzle whose solved picture is the Mosaic mark: four gold tiles among grey.
export const PUZZLE_COLS = 4;
const PUZZLE_ROWS = 3;
export const PUZZLE_SIZE = PUZZLE_COLS * PUZZLE_ROWS;
export const MARK_TILES = new Set([1, 6, 8, 11]);
export const LAST_TILE = PUZZLE_SIZE - 1;

const neighbours = (slot) => {
    const col = slot % PUZZLE_COLS;
    const row = Math.floor(slot / PUZZLE_COLS);
    return [col > 0 && slot - 1, col < PUZZLE_COLS - 1 && slot + 1, row > 0 && slot - PUZZLE_COLS, row < PUZZLE_ROWS - 1 && slot + PUZZLE_COLS].filter(
        (value) => value !== false,
    );
};

// `slots[i]` is the tile sitting in slot i, null for the gap; solved means slot i holds tile i.
export const solvedSlots = () => Array.from({ length: PUZZLE_SIZE }, (_unused, i) => (i === LAST_TILE ? null : i));

// Walks the gap at random from the solved picture; replaying the walk backwards solves it.
export const scramble = (moves, random = Math.random) => {
    const slots = solvedSlots();
    let gap = LAST_TILE;
    let previous = -1;
    const path = [gap];
    for (let n = 0; n < moves; n += 1) {
        const options = neighbours(gap).filter((slot) => slot !== previous);
        const next = options[Math.floor(random() * options.length)];
        slots[gap] = slots[next];
        slots[next] = null;
        previous = gap;
        gap = next;
        path.push(gap);
    }
    return { slots, solution: path.reverse().slice(1) };
};

// Slides the tile in `slot` into the gap beside it.
export const slide = (slots, slot) => {
    const gap = slots.indexOf(null);
    const next = [...slots];
    next[gap] = next[slot];
    next[slot] = null;
    return next;
};
