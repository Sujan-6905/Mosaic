import { cutFor, drawStone, rank } from "@/components/stoneScene/stones";

export const TESSERA_SIZES = [
    { value: "fine", label: "Fine", cell: 10 },
    { value: "medium", label: "Medium", cell: 16 },
    { value: "coarse", label: "Coarse", cell: 26 },
];

const GROUT = "#0b0c0f";
const GOLD = ["#ffb43c", "#c07d1c"];
const MAKER_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
const POSTER_MAX = 4000;

// Each stone takes the average colour of the board under it, nudged a little brighter or darker by hand.
export function sampleStones(source, cell) {
    const width = source.width;
    const height = source.height;
    const pixels = source.getContext("2d").getImageData(0, 0, width, height).data;
    const cols = Math.max(1, Math.floor(width / cell));
    const rows = Math.max(1, Math.floor(height / cell));
    const stones = [];
    const step = Math.max(1, Math.floor(cell / 5));
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            let r = 0;
            let g = 0;
            let b = 0;
            let n = 0;
            for (let y = row * cell + 1; y < (row + 1) * cell; y += step) {
                for (let x = col * cell + 1; x < (col + 1) * cell; x += step) {
                    const k = (y * width + x) * 4;
                    r += pixels[k];
                    g += pixels[k + 1];
                    b += pixels[k + 2];
                    n += 1;
                }
            }
            const index = row * cols + col;
            const lift = 0.9 + rank(index * 3 + 1) * 0.22;
            stones.push({
                index,
                col,
                row,
                color: `rgb(${Math.min(255, (r / n) * lift) | 0},${Math.min(255, (g / n) * lift) | 0},${Math.min(255, (b / n) * lift) | 0})`,
                cut: cutFor(index, cell * 0.16),
            });
        }
    }
    return { cell, cols, rows, stones };
}

export const stoneHalf = (cell) => cell / 2 - Math.max(0.8, cell * 0.06);

// A maker's tile colour follows their name, so the same person signs every poster the same way.
const makerColor = (name) => {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return MAKER_COLORS[hash % MAKER_COLORS.length];
};

const signatureLine = (makers) => {
    if (makers.length === 0) return "Laid in Mosaic";
    if (makers.length <= 3) return `Laid by ${makers.slice(0, -1).join(", ")}${makers.length > 1 ? " and " : ""}${makers.at(-1)}`;
    return `Laid by ${makers.slice(0, 2).join(", ")} and ${makers.length - 2} others`;
};

// The board laid in stone inside a gilded frame, over a band with its name, a tile per contributor and the mark.
export function tessellatePoster(source, { cell, title, makers }) {
    const fit = Math.min(1, POSTER_MAX / Math.max(source.width, source.height));
    const board = fit < 1 ? scaled(source, fit) : source;
    const layout = sampleStones(board, cell);
    const frame = cell * 2;
    const band = Math.max(96, cell * 7);
    const innerW = layout.cols * cell;
    const innerH = layout.rows * cell;
    const poster = document.createElement("canvas");
    poster.width = innerW + frame * 2;
    poster.height = innerH + frame * 2 + band;
    const g = poster.getContext("2d");
    g.fillStyle = GROUT;
    g.fillRect(0, 0, poster.width, poster.height);

    const half = stoneHalf(cell);
    const frameCols = Math.round(poster.width / cell);
    const frameRows = Math.round((innerH + frame * 2) / cell);
    for (let row = 0; row < frameRows; row += 1) {
        for (let col = 0; col < frameCols; col += 1) {
            const inside = col >= 2 && col < frameCols - 2 && row >= 2 && row < frameRows - 2;
            if (inside) continue;
            const index = 100000 + row * frameCols + col;
            const corner = (col < 2 || col >= frameCols - 2) && (row < 2 || row >= frameRows - 2);
            drawStone(g, {
                x: (col + 0.5) * cell,
                y: (row + 0.5) * cell,
                half,
                cut: cutFor(index, cell * 0.16),
                color: corner ? "#de5816" : GOLD[(col + row) % 2],
                shine: rank(index) * 0.18,
            });
        }
    }
    for (const stone of layout.stones) {
        drawStone(g, { x: frame + (stone.col + 0.5) * cell, y: frame + (stone.row + 0.5) * cell, half, cut: stone.cut, color: stone.color });
    }

    const bandTop = innerH + frame * 2;
    const tile = Math.round(band * 0.3);
    const gap = Math.round(tile * 0.25);
    makers.slice(0, 8).forEach((name, index) => {
        const x = frame + index * (tile + gap) + tile / 2;
        drawStone(g, { x, y: bandTop + band / 2, half: tile / 2 - 2, cut: cutFor(200000 + index, tile * 0.08), color: makerColor(name) });
    });
    const textX = frame + Math.min(makers.length, 8) * (tile + gap) + (makers.length ? gap : 0);
    g.textBaseline = "alphabetic";
    g.fillStyle = "#ecebe6";
    g.font = `800 ${Math.round(band * 0.26)}px Zodiak, Georgia, serif`;
    g.fillText(title || "A Mosaic board", textX, bandTop + band * 0.48, poster.width - textX - frame * 6);
    g.fillStyle = "#a4a7ae";
    g.font = `italic 400 ${Math.round(band * 0.17)}px Zodiak, Georgia, serif`;
    g.fillText(signatureLine(makers), textX, bandTop + band * 0.74, poster.width - textX - frame * 6);
    drawMark(g, poster.width - frame - tile, bandTop + band / 2, tile);
    return poster;
}

// The four-tile mark, as it sits in the tab and the header.
function drawMark(g, x, y, size) {
    const tile = size * 0.44;
    const colors = ["#ffb43c", "#2d343b", "#de5816", "#868a92"];
    colors.forEach((color, n) => {
        g.fillStyle = color;
        g.beginPath();
        g.roundRect(x - size / 2 + (n % 2) * (size - tile), y - size / 2 + Math.floor(n / 2) * (size - tile), tile, tile, tile * 0.18);
        g.fill();
    });
}

function scaled(source, factor) {
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(source.width * factor));
    out.height = Math.max(1, Math.round(source.height * factor));
    out.getContext("2d").drawImage(source, 0, 0, out.width, out.height);
    return out;
}
