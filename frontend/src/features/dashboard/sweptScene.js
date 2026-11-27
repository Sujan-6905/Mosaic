import { clamp01, rank } from "@/components/stoneScene/stones";

const GRAVITY = 1300;

// Copies what a board's thumbnail shows, ground included, into a canvas the pieces are cut from.
export function snapshotThumbnail(container) {
    const box = container.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const image = document.createElement("canvas");
    image.width = Math.max(1, Math.round(box.width * ratio));
    image.height = Math.max(1, Math.round(box.height * ratio));
    const g = image.getContext("2d");
    const style = getComputedStyle(container);
    g.fillStyle = style.backgroundColor;
    g.fillRect(0, 0, image.width, image.height);
    const preview = container.querySelector("canvas");
    if (preview) g.drawImage(preview, 0, 0, image.width, image.height);
    return { image, width: box.width, height: box.height };
}

// A swept board's thumbnail breaks into tiles that pile on the card's floor, and returns when it is put back.
export function createSweptScene({ image, width, height, calm, slotColor }) {
    const cols = width > 180 ? 10 : 5;
    const rows = Math.max(2, Math.round((cols * height) / width));
    const pw = width / cols;
    const ph = height / rows;
    const sx = image.width / width;
    const sy = image.height / height;
    const pieces = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const i = row * cols + col;
            const hx = (col + 0.5) * pw;
            const hy = (row + 0.5) * ph;
            pieces.push({
                col,
                row,
                hx,
                hy,
                x: hx,
                y: hy,
                vx: (rank(i) - 0.5) * 220 + (col - cols / 2) * 14,
                vy: -80 - rank(i + 40) * 180,
                rot: 0,
                vr: (rank(i + 80) - 0.5) * 12,
                wait: (rows - row) * 0.035 + rank(i + 120) * 0.08,
                stack: rank(i + 160) * rank(i + 200) * height * 0.28,
            });
        }
    }

    let state = "falling";
    let fade = 0;
    let onHome = null;

    const fall = (dt) => {
        for (const p of pieces) {
            if (p.wait > 0) {
                p.wait -= dt;
                continue;
            }
            p.vy += GRAVITY * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            p.x = Math.max(pw / 2, Math.min(width - pw / 2, p.x));
            const rest = height - p.stack - ph / 2;
            if (p.y > rest) {
                p.y = rest;
                p.vy *= -0.3;
                p.vx *= 0.6;
                p.vr *= 0.45;
                if (Math.abs(p.vy) < 50) {
                    p.vy = 0;
                    p.vr *= 0.7;
                }
            }
        }
    };

    const gather = (dt) => {
        let home = true;
        for (const p of pieces) {
            if (p.wait > 0) {
                p.wait -= dt;
                home = false;
                continue;
            }
            p.vx += ((p.hx - p.x) * 150 - p.vx * 17) * dt;
            p.vy += ((p.hy - p.y) * 150 - p.vy * 17) * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const upright = Math.round(p.rot / (Math.PI * 2)) * Math.PI * 2;
            p.rot += (upright - p.rot) * (1 - Math.exp(-10 * dt));
            if (Math.hypot(p.hx - p.x, p.hy - p.y) > 0.7 || Math.abs(upright - p.rot) > 0.02) home = false;
        }
        return home;
    };

    return {
        width,
        height,
        restore(done) {
            state = "returning";
            onHome = done;
            pieces.forEach((p, n) => {
                p.wait = n * 0.006;
            });
        },
        step(dt) {
            if (calm) {
                fade = clamp01(fade + (state === "returning" ? -dt : dt) * 3);
                if (state === "returning" && fade === 0) state = "home";
            } else if (state === "falling") fall(dt);
            else if (state === "returning" && gather(dt)) state = "home";
            if (state === "home" && onHome) {
                const done = onHome;
                onHome = null;
                done();
            }
        },
        draw(g) {
            g.clearRect(0, 0, width, height);
            g.strokeStyle = slotColor;
            g.lineWidth = 1.5;
            g.setLineDash([7, 7]);
            g.strokeRect(4, 4, width - 8, height - 8);
            g.setLineDash([]);
            for (const p of pieces) {
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.globalAlpha = calm ? 1 - fade : 1;
                g.drawImage(image, p.col * pw * sx, p.row * ph * sy, pw * sx, ph * sy, -pw / 2 + 0.6, -ph / 2 + 0.6, pw - 1.2, ph - 1.2);
                g.strokeStyle = "rgba(255,255,255,.14)";
                g.lineWidth = 1;
                g.strokeRect(-pw / 2 + 0.6, -ph / 2 + 0.6, pw - 1.2, ph - 1.2);
                g.restore();
            }
        },
    };
}
