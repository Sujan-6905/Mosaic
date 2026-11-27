import { isCalm } from "@/lib/calmMode";
import { GOLD, STONE, cutFor, drawStone, easeOut } from "./stones";

const CELL = 46;
const WAVE_MS = 900;
const HOLD_MS = 350;

// Sign-out animation: tiles turn face down from the middle out, leaving one gold stone where the person was.
// Resolves once the floor is covered, so sign-out carries on underneath.
export function layTilesToRest() {
    if (typeof document === "undefined") return Promise.resolve();
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "2147483000", pointerEvents: "none" });
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const g = canvas.getContext("2d");
    g.scale(ratio, ratio);

    if (isCalm()) {
        canvas.style.background = "#15171b";
        canvas.style.opacity = "0";
        canvas.style.transition = "opacity 250ms ease";
        requestAnimationFrame(() => (canvas.style.opacity = "1"));
        return new Promise((resolve) => setTimeout(resolve, 300));
    }

    const cols = Math.ceil(width / CELL) + 1;
    const rows = Math.ceil(height / CELL) + 1;
    const cx = width / 2;
    const cy = height / 2;
    const reach = Math.hypot(cx, cy);
    const centre = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    const tiles = Array.from({ length: cols * rows }, (_unused, i) => {
        const x = (i % cols) * CELL + CELL / 2 - (cols * CELL - width) / 2;
        const y = Math.floor(i / cols) * CELL + CELL / 2 - (rows * CELL - height) / 2;
        return { i, x, y, cut: cutFor(i, 4), delay: (Math.hypot(x - cx, y - cy) / reach) * WAVE_MS * 0.7 };
    });

    return new Promise((resolve) => {
        const start = performance.now();
        const frame = (now) => {
            const elapsed = now - start;
            g.clearRect(0, 0, width, height);
            for (const tile of tiles) {
                const turn = easeOut((elapsed - tile.delay) / 300);
                if (turn <= 0) continue;
                const gold = tile.i === centre;
                drawStone(g, {
                    x: tile.x,
                    y: tile.y,
                    half: CELL / 2 - 1.5,
                    cut: tile.cut,
                    color: gold ? GOLD[0] : STONE[tile.i % 4],
                    scaleY: Math.max(0.04, turn),
                    shine: gold ? 0.3 : 0.03,
                });
            }
            if (elapsed < WAVE_MS + HOLD_MS) requestAnimationFrame(frame);
            else resolve();
        };
        requestAnimationFrame(frame);
    });
}
