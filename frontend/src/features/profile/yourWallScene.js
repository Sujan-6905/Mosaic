import { Lamp } from "@/components/stoneScene/stones";

const DAYS = 7;
const TW = 18;
const TH = 9;
const RISE = 34;
const HOVER_STICKINESS = 3;
const RAMP = [
    [36, 40, 46],
    [90, 63, 20],
    [150, 103, 29],
    [214, 146, 43],
    [255, 180, 60],
];

const shade = (value, light) => {
    const p = Math.max(0, Math.min(0.999, value)) * (RAMP.length - 1);
    const a = RAMP[Math.floor(p)];
    const b = RAMP[Math.floor(p) + 1];
    const f = p - Math.floor(p);
    const channel = (k) => Math.min(255, (a[k] + (b[k] - a[k]) * f) * light) | 0;
    return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
};

const dateLabel = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

// A year as raised tiles: one per day, weeks running down to the right, each as tall as that day's pieces.
export function createYourWallScene({ days, calm }) {
    const weeks = Math.ceil(days.length / DAYS);
    const most = Math.max(1, ...days.map((entry) => entry.pieces));
    const width = (weeks + DAYS) * (TW / 2) + 40;
    const height = (weeks + DAYS) * (TH / 2) + RISE + 70;
    const ox = DAYS * (TW / 2) + 20;
    const oy = RISE + 40;
    const tiles = days.map((entry, n) => ({
        ...entry,
        w: Math.floor(n / DAYS),
        d: n % DAYS,
        v: entry.pieces ? 0.18 + 0.82 * Math.sqrt(entry.pieces / most) : 0,
        h: calm ? 0 : -0.2,
        vel: 0,
    }));
    tiles.forEach((tile) => {
        if (calm) tile.h = tile.v;
    });
    const lamp = new Lamp(width, height);
    let time = 0;
    let aim = null;
    let hover = null;

    const place = (w, d) => ({ x: ox + (w - d) * (TW / 2), y: oy + (w + d) * (TH / 2) });

    return {
        width,
        height,
        pointer(x, y) {
            aim = [x, y];
            lamp.aim(x, y);
        },
        leave() {
            aim = null;
        },
        step(dt) {
            time += dt;
            lamp.step(dt);
            for (const tile of tiles) {
                const due = time > tile.w * 0.03 + tile.d * 0.01;
                const goal = due ? tile.v + (hover === tile ? 0.2 : 0) : 0;
                if (calm) tile.h = goal;
                else {
                    tile.vel += ((goal - tile.h) * 130 - tile.vel * 11) * dt;
                    tile.h += tile.vel * dt;
                }
            }
            if (!aim) {
                hover = null;
                return;
            }
            // Measured against each tile's resting height, not its hover lift, and the current tile keeps the
            // pointer until another is clearly closer; otherwise two neighbours trade the hover every frame.
            const distanceTo = (tile) => {
                const at = place(tile.w, tile.d);
                return Math.hypot(at.x - aim[0], at.y - Math.max(0, Math.min(tile.h, tile.v)) * RISE - aim[1]);
            };
            let next = null;
            let best = 16;
            for (const tile of tiles) {
                const distance = distanceTo(tile);
                if (distance < best) {
                    best = distance;
                    next = tile;
                }
            }
            if (hover && next !== hover && distanceTo(hover) < Math.min(16, best + HOVER_STICKINESS)) return;
            hover = next;
        },
        draw(g) {
            g.clearRect(0, 0, width, height);
            const hw = TW / 2 - 1;
            const hh = TH / 2 - 0.6;
            for (let sum = 0; sum < weeks + DAYS - 1; sum += 1) {
                for (let d = 0; d < DAYS; d += 1) {
                    const tile = tiles[(sum - d) * DAYS + d];
                    if (sum - d < 0 || !tile) continue;
                    const at = place(tile.w, tile.d);
                    const rise = Math.max(0, tile.h) * RISE;
                    const top = at.y - rise;
                    if (rise > 0.5) {
                        g.fillStyle = shade(tile.v, 0.5);
                        g.beginPath();
                        g.moveTo(at.x - hw, top);
                        g.lineTo(at.x, top + hh);
                        g.lineTo(at.x, at.y + hh);
                        g.lineTo(at.x - hw, at.y);
                        g.fill();
                        g.fillStyle = shade(tile.v, 0.72);
                        g.beginPath();
                        g.moveTo(at.x + hw, top);
                        g.lineTo(at.x, top + hh);
                        g.lineTo(at.x, at.y + hh);
                        g.lineTo(at.x + hw, at.y);
                        g.fill();
                    }
                    const near = calm ? 0 : lamp.nearness(at.x, top, 150);
                    g.fillStyle = shade(tile.v, 1 + near * 0.45 + (hover === tile ? 0.4 : 0));
                    g.beginPath();
                    g.moveTo(at.x, top - hh);
                    g.lineTo(at.x + hw, top);
                    g.lineTo(at.x, top + hh);
                    g.lineTo(at.x - hw, top);
                    g.fill();
                    g.strokeStyle = "rgba(255,255,255,.1)";
                    g.lineWidth = 1;
                    g.beginPath();
                    g.moveTo(at.x - hw, top);
                    g.lineTo(at.x, top - hh);
                    g.lineTo(at.x + hw, top);
                    g.stroke();
                }
            }
            if (hover) {
                const at = place(hover.w, hover.d);
                const text = hover.pieces
                    ? `${dateLabel(hover.day)}: ${hover.pieces} piece${hover.pieces === 1 ? "" : "s"} on ${hover.boards} board${hover.boards === 1 ? "" : "s"}`
                    : `${dateLabel(hover.day)}: a day off`;
                g.font = "500 12px system-ui, sans-serif";
                const labelWidth = g.measureText(text).width + 20;
                const x = Math.max(6, Math.min(width - labelWidth - 6, at.x - labelWidth / 2));
                const y = Math.max(4, at.y - Math.max(0, hover.h) * RISE - 40);
                g.fillStyle = "#ecebe6";
                g.beginPath();
                g.roundRect(x, y, labelWidth, 26, 7);
                g.fill();
                g.fillStyle = "#15171b";
                g.fillText(text, x + 10, y + 17);
            }
        },
    };
}
