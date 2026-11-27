import { Debris, GOLD, STONE, cutFor, drawStone, easeOut, rank } from "@/components/stoneScene/stones";

const COLS = 11;
const ROWS = 5;
const CELL = 20;
const PATCH = [
    [4, 1],
    [5, 1],
    [6, 1],
    [4, 2],
    [5, 2],
    [6, 2],
    [4, 3],
    [5, 3],
    [6, 3],
];
const RESTORATION_STEPS = 3;

// Account recovery as a repair: a missing patch of floor is re-laid a third at a time as the form fills in,
// then sealed in gold when recovery succeeds.
export function createRestorationScene({ calm }) {
    const width = COLS * CELL;
    const height = ROWS * CELL;
    const debris = new Debris();
    const missing = new Set(PATCH.map(([c, r]) => `${c},${r}`));
    const tiles = [];
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            const i = row * COLS + col;
            const patchIndex = PATCH.findIndex(([c, r]) => c === col && r === row);
            tiles.push({
                i,
                col,
                row,
                patchIndex,
                x: (col + 0.5) * CELL,
                y: (row + 0.5) * CELL,
                cut: cutFor(i + 300, 2.6),
                set: missing.has(`${col},${row}`) ? 0 : 1,
                target: missing.has(`${col},${row}`) ? 0 : 1,
            });
        }
    }
    const patch = tiles.filter((tile) => tile.patchIndex >= 0).sort((a, b) => a.patchIndex - b.patchIndex);
    let gilt = 0;
    let sealing = false;

    return {
        width,
        height,
        setProgress(steps) {
            const count = Math.round((patch.length * Math.max(0, Math.min(RESTORATION_STEPS, steps))) / RESTORATION_STEPS);
            patch.forEach((tile, n) => {
                tile.target = n < count ? 1 : 0;
            });
        },
        seal() {
            patch.forEach((tile) => {
                tile.target = 1;
            });
            sealing = true;
        },
        step(dt) {
            for (const tile of tiles) {
                const before = tile.set;
                tile.set = calm ? tile.target : tile.set + (tile.target - tile.set) * (1 - Math.exp(-9 * dt));
                if (before < 0.9 && tile.set >= 0.9 && tile.target === 1 && !calm) debris.dust(tile.x, tile.y + 6, 3);
            }
            if (sealing) {
                const before = gilt;
                gilt = Math.min(1, gilt + dt * (calm ? 4 : 1.2));
                if (before === 0 && !calm) patch.forEach((tile) => debris.spark(tile.x, tile.y, 2, rank(tile.i) * 0.3));
            }
            debris.step(dt);
        },
        draw(g) {
            g.clearRect(0, 0, width, height);
            for (const tile of tiles) {
                if (tile.patchIndex >= 0) {
                    g.fillStyle = "rgba(0,0,0,.35)";
                    g.fillRect(tile.x - CELL / 2 + 2, tile.y - CELL / 2 + 2, CELL - 4, CELL - 4);
                }
                if (tile.set < 0.02) continue;
                const drop = (1 - easeOut(tile.set)) * -18;
                const seam = tile.patchIndex >= 0 && gilt > 0;
                drawStone(g, {
                    x: tile.x,
                    y: tile.y + drop,
                    half: CELL / 2 - 1.4,
                    cut: tile.cut,
                    color: seam ? GOLD[tile.i % 4] : STONE[tile.i % 4],
                    alpha: Math.min(1, tile.set * 1.4),
                    shine: seam ? Math.sin(gilt * Math.PI) * 0.4 : 0.04,
                });
            }
            debris.draw(g);
        },
    };
}
