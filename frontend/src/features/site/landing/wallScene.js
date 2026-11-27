import { Lamp, cutFor, drawStone, isGilt, rank } from "@/components/stoneScene/stones";
import { WALL_COLS as COLS, WALL_ROWS as ROWS } from "../../../../../shared/rules/landingWall.js";

const CELL = 16;
const VW = COLS * CELL;
const VH = ROWS * CELL;
const RISE_SECONDS = 0.3;

// The hidden cartoon: a medallion in a latticed field, the way a floor emblem is drawn.
function cartoon(x, y) {
    const dx = x - COLS / 2 + 0.5;
    const dy = y - ROWS / 2 + 0.5;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return (x + y) % 2 ? "#c07d1c" : "#e09a2c";
    if (x === 1 || y === 1 || x === COLS - 2 || y === ROWS - 2) return (x + y) % 2 ? "#d8d4c6" : "#2e333a";
    if (r < 2.6) return "#ffb43c";
    if (r < 7.6) return r < 2.6 + 5 * Math.pow(Math.abs(Math.cos(a * 4)), 0.8) ? "#de5816" : "#e2ded1";
    if (r < 9.2) return Math.floor(((a + Math.PI) * 16) / Math.PI) % 2 ? "#3d5a9e" : "#5b78b8";
    if (r < 12.6) return Math.sin(a * 12 + r * 1.5) > 0 ? "#c07d1c" : "#3b4048";
    if (r < 13.8) return "#d8d4c6";
    if (r < 15.4) return Math.floor(((a + Math.PI) * 24) / Math.PI) % 2 ? "#de5816" : "#ffb43c";
    if (r < 16.4) return "#2e333a";
    if ((x + y) % 9 === 0 || (x - y + 90) % 9 === 0) return "#868a92";
    if ((x + y) % 9 === 4 && (x - y + 90) % 9 === 4) return "#ffb43c";
    return ["#24282e", "#2a2e35", "#272b31"][(x * 7 + y * 3) % 3];
}

// Settled stones are painted once to a layer; only what moves is drawn per frame: incoming stones, the light
// gold answers to, and each landing's ring and tag.
export class WallScene {
    width = VW;
    height = VH;

    constructor({ calm, onPick }) {
        this.still = calm;
        this.onPick = onPick;
        this.time = 0;
        this.lamp = new Lamp(VW, VH);
        this.hover = -1;
        this.mine = -1;
        this.pending = -1;
        this.flying = [];
        this.queue = [];
        this.sparks = [];
        this.tags = [];
        this.tiles = [];
        for (let y = 0; y < ROWS; y += 1) {
            for (let x = 0; x < COLS; x += 1) {
                const i = y * COLS + x;
                this.tiles.push({
                    i,
                    x,
                    y,
                    hx: (x + 0.5) * CELL,
                    hy: (y + 0.5) * CELL,
                    color: cartoon(x, y),
                    laid: false,
                    air: false,
                    born: 0,
                    cut: cutFor(i, 2.4),
                });
            }
        }
        this.layer = document.createElement("canvas");
        this.layer.width = VW * 2;
        this.layer.height = VH * 2;
        this.dirty = true;
    }

    isLaid(index) {
        return !!this.tiles[index]?.laid;
    }

    // First load: stones rise into place outward from the centre.
    load(stones, mine) {
        const start = this.time;
        for (const index of stones) {
            const tile = this.tiles[index];
            if (!tile || tile.laid) continue;
            tile.laid = true;
            tile.born = this.still ? start - 1 : start + Math.hypot(tile.x - COLS / 2, tile.y - ROWS / 2) / 38 + rank(index + 7) * 0.25;
        }
        if (mine !== null && mine >= 0) this.claim(mine, false);
        this.dirty = true;
    }

    claim(index, thrown) {
        this.mine = index;
        this.pending = -1;
        const tile = this.tiles[index];
        // A poll can report this stone a moment before the reply that set it does.
        const queued = this.queue.some((entry) => entry.tile === tile);
        this.queue = this.queue.filter((entry) => entry.tile !== tile);
        if (thrown && (!tile.laid || queued)) this.throwIn(tile, "You");
        else {
            tile.laid = true;
            this.dirty = true;
            this.tags.push({ x: tile.hx, y: tile.hy, who: "You", life: 1 });
        }
    }

    // Stones other people set since the last look, spread across the wait so they read as live.
    arrive(indices, spread) {
        for (const index of indices) {
            const tile = this.tiles[index];
            if (!tile || tile.laid) continue;
            tile.laid = true;
            tile.air = true;
            this.queue.push({ tile, at: this.time + Math.random() * spread });
        }
    }

    throwIn(tile, who) {
        tile.laid = true;
        if (this.still) {
            tile.air = false;
            tile.born = this.time - 1;
            this.dirty = true;
            this.tags.push({ x: tile.hx, y: tile.hy, who, life: 0 });
            return;
        }
        tile.air = true;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.flying.push({
            tile,
            x: tile.hx + side * (60 + Math.random() * 120),
            y: tile.hy - 150 - Math.random() * 90,
            vx: 0,
            vy: 0,
            rot: (Math.random() - 0.5) * 7,
            who,
        });
    }

    cellAt(x, y) {
        const col = Math.floor(x / CELL);
        const row = Math.floor(y / CELL);
        return col >= 0 && col < COLS && row >= 0 && row < ROWS ? row * COLS + col : -1;
    }

    pointer(x, y, event) {
        this.lamp.aim(x, y);
        this.hover = this.cellAt(x, y);
        if (event.type === "pointerdown" && this.hover >= 0 && !this.tiles[this.hover].laid && this.mine < 0 && this.pending < 0) {
            this.pending = this.hover;
            this.onPick?.(this.hover);
        }
    }

    leave() {
        this.hover = -1;
    }

    land(f) {
        const { tile } = f;
        f.done = true;
        tile.air = false;
        tile.born = this.time - 1;
        this.dirty = true;
        const mine = f.who === "You";
        const gilt = isGilt(tile.color) || mine;
        for (let n = 0; n < (mine ? 34 : gilt ? 7 : 4); n += 1) {
            const a = Math.random() * Math.PI * 2;
            const v = (gilt ? 130 : 46) * (0.3 + Math.random() * 0.7);
            this.sparks.push({
                spark: gilt,
                x: tile.hx,
                y: tile.hy,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v - (gilt ? 40 : 14),
                life: 0,
                span: 0.4 + Math.random() * 0.6,
                size: 0.8 + Math.random() * 1.6,
            });
        }
        this.tags.push({ x: tile.hx, y: tile.hy, who: f.who, life: 0 });
    }

    step(dt) {
        this.time += dt;
        this.lamp.step(dt);
        if (this.tiles.some((tile) => tile.laid && !tile.air && this.time < tile.born + RISE_SECONDS + 0.1)) this.dirty = true;
        for (const queued of this.queue) if (queued.at <= this.time) this.throwIn(queued.tile, "Just now");
        this.queue = this.queue.filter((queued) => queued.at > this.time);
        for (const f of this.flying) {
            const { tile } = f;
            f.vx += ((tile.hx - f.x) * 130 - f.vx * 15) * dt;
            f.vy += ((tile.hy - f.y) * 130 - f.vy * 15) * dt;
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.rot *= Math.exp(-6 * dt);
            if (Math.hypot(tile.hx - f.x, tile.hy - f.y) < 0.8 && Math.hypot(f.vx, f.vy) < 16) this.land(f);
        }
        this.flying = this.flying.filter((f) => !f.done);
        for (const p of this.sparks) {
            p.life += dt;
            if (p.spark) p.vy += 260 * dt;
            else {
                p.vx *= Math.exp(-4 * dt);
                p.vy *= Math.exp(-4 * dt);
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        this.sparks = this.sparks.filter((p) => p.life < p.span);
        for (const tag of this.tags) tag.life += dt;
        this.tags = this.tags.filter((tag) => tag.who === "You" || tag.life < 2.4);
    }

    repaint() {
        const g = this.layer.getContext("2d");
        g.setTransform(2, 0, 0, 2, 0, 0);
        g.fillStyle = "#0f1114";
        g.fillRect(0, 0, VW, VH);
        for (let n = 0; n < 5200; n += 1) {
            g.fillStyle = rank(n * 3 + 1) > 0.5 ? "rgba(236,235,230,.035)" : "rgba(0,0,0,.28)";
            g.fillRect(rank(n) * VW, rank(n + 9000) * VH, 1.5, 1);
        }
        for (const tile of this.tiles) {
            if (tile.laid && !tile.air && this.time >= tile.born + RISE_SECONDS)
                drawStone(g, { x: tile.hx, y: tile.hy, half: CELL / 2 - 1.1, cut: tile.cut, color: tile.color });
            else if (!tile.laid) {
                // An empty socket in the mortar bed, waiting for its stone.
                g.fillStyle = "rgba(0,0,0,.32)";
                g.fillRect(tile.hx - CELL / 2 + 2, tile.hy - CELL / 2 + 2, CELL - 4, CELL - 4);
                g.fillStyle = "rgba(236,235,230,.045)";
                g.fillRect(tile.hx - CELL / 2 + 2, tile.hy + CELL / 2 - 3, CELL - 4, 1);
                g.fillStyle = "rgba(236,235,230,.08)";
                g.fillRect(tile.hx - 1, tile.hy - 1, 2, 2);
            }
        }
        this.dirty = false;
    }

    draw(g) {
        if (this.dirty) this.repaint();
        g.drawImage(this.layer, 0, 0, VW, VH);
        const half = CELL / 2 - 1.1;

        for (const tile of this.tiles) {
            if (!tile.laid || tile.air) continue;
            const age = this.time - tile.born;
            if (age < 0 || age >= RISE_SECONDS) continue;
            const grow = 1 - Math.pow(1 - age / RISE_SECONDS, 3);
            drawStone(g, { x: tile.hx, y: tile.hy - (1 - grow) * 10, half, cut: tile.cut, color: tile.color, scaleX: grow, scaleY: grow });
        }

        // Gold answers the light; only stones near it are worth the work.
        const lamp = this.lamp;
        const c0 = Math.max(0, Math.floor((lamp.x - 130) / CELL));
        const c1 = Math.min(COLS - 1, Math.floor((lamp.x + 130) / CELL));
        const r0 = Math.max(0, Math.floor((lamp.y - 130) / CELL));
        const r1 = Math.min(ROWS - 1, Math.floor((lamp.y + 130) / CELL));
        for (let y = r0; y <= r1; y += 1) {
            for (let x = c0; x <= c1; x += 1) {
                const tile = this.tiles[y * COLS + x];
                if (!tile.laid || tile.air || this.time < tile.born + RISE_SECONDS) continue;
                const near = lamp.nearness(tile.hx, tile.hy, 130);
                const shine = near * near * (isGilt(tile.color) ? 0.6 : 0.13) * (0.5 + rank(tile.i * 5) * 0.5);
                if (shine > 0.02) drawStone(g, { x: tile.hx, y: tile.hy, half, cut: tile.cut, color: tile.color, shine });
            }
        }

        const ghost = this.pending >= 0 ? this.pending : this.mine < 0 ? this.hover : -1;
        if (ghost >= 0 && !this.tiles[ghost].laid) {
            const tile = this.tiles[ghost];
            g.strokeStyle = "#ffb43c";
            g.lineWidth = 1.5;
            g.strokeRect(tile.hx - CELL / 2 + 1, tile.hy - CELL / 2 + 1, CELL - 2, CELL - 2);
            g.fillStyle = tile.color;
            g.globalAlpha = 0.45 + Math.sin(this.time * (this.pending >= 0 ? 14 : 6)) * 0.15;
            g.fillRect(tile.hx - 4, tile.hy - 4, 8, 8);
            g.globalAlpha = 1;
        }

        for (const f of this.flying) {
            const { tile } = f;
            const height = Math.min(1, Math.hypot(tile.hx - f.x, tile.hy - f.y) / 120);
            g.fillStyle = `rgba(0,0,0,${0.4 * (1 - height)})`;
            g.beginPath();
            g.ellipse(tile.hx + 2, tile.hy + 3, 7, 5, 0, 0, Math.PI * 2);
            g.fill();
            drawStone(g, {
                x: f.x,
                y: f.y,
                half,
                cut: tile.cut,
                color: tile.color,
                rot: f.rot,
                scaleX: 1 + height * 0.5,
                scaleY: 1 + height * 0.5,
                shine: 0.1,
            });
        }

        lamp.draw(g, 190, 0.12);
        g.globalCompositeOperation = "lighter";
        for (const p of this.sparks) {
            if (!p.spark) continue;
            const fade = 1 - p.life / p.span;
            g.fillStyle = `rgba(255,${170 + Math.floor(fade * 70)},70,${fade})`;
            g.beginPath();
            g.arc(p.x, p.y, p.size * fade + 0.3, 0, Math.PI * 2);
            g.fill();
        }
        g.globalCompositeOperation = "source-over";
        for (const p of this.sparks) {
            if (p.spark) continue;
            const fade = 1 - p.life / p.span;
            g.fillStyle = `rgba(214,208,192,${fade * 0.3})`;
            g.beginPath();
            g.arc(p.x, p.y, p.size + (1 - fade) * 4, 0, Math.PI * 2);
            g.fill();
        }
        this.drawTags(g);
    }

    drawTags(g) {
        g.font = "500 10px 'Azeret Mono', ui-monospace, monospace";
        g.textBaseline = "middle";
        for (const tag of this.tags) {
            const mine = tag.who === "You";
            const fade = mine ? 1 : Math.min(1, tag.life / 0.15) * Math.max(0, 1 - Math.max(0, tag.life - 1.7) / 0.7);
            const ring = Math.min(1, tag.life / 0.6);
            g.strokeStyle = `rgba(255,180,60,${(1 - ring) * 0.8})`;
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(tag.x, tag.y, 8 + ring * 22, 0, Math.PI * 2);
            g.stroke();
            if (mine) {
                g.strokeStyle = "#ffb43c";
                g.lineWidth = 2;
                g.strokeRect(tag.x - CELL / 2 - 1, tag.y - CELL / 2 - 1, CELL + 2, CELL + 2);
            }
            const label = mine ? "YOURS" : tag.who.toUpperCase();
            const width = g.measureText(label).width + 14;
            const left = Math.min(VW - width - 4, tag.x + 14);
            const top = Math.max(4, tag.y - 26 - (1 - fade) * 4);
            g.globalAlpha = fade;
            g.fillStyle = mine ? "#ffb43c" : "rgba(21,23,27,.92)";
            g.beginPath();
            g.roundRect(left, top, width, 18, 9);
            g.fill();
            g.fillStyle = mine ? "#1a1206" : "#ecebe6";
            g.fillText(label, left + 7, top + 9.5);
            g.globalAlpha = 1;
        }
        g.textBaseline = "alphabetic";
    }
}
