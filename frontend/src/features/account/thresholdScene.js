import { Debris, GOLD, Lamp, STONE, cutFor, drawStone, easeOut, rank } from "@/components/stoneScene/stones";

const COLS = 27;
const ROWS = 11;
const CELL = 16;
const WALL_W = COLS * CELL;
const WALL_H = ROWS * CELL;
const FLOOR = WALL_H + 58;
const VH = FLOOR + 6;
const LETTERS = {
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
};
const WORD_TOP = 2;
const WORD_LEFT = 2;

const inWord = (col, row) => {
    const r = row - WORD_TOP;
    const c = col - WORD_LEFT;
    if (r < 0 || r > 6 || c < 0 || c > 22) return false;
    const within = c % 6;
    return within <= 4 && LETTERS["HAVE"[Math.floor(c / 6)]][r][within] === "#";
};

const GREETING_SECONDS = 1.25;
const PART_SECONDS = 1.1;

// A wrong password shakes the wall and knocks stones loose; the next try gathers them back. The right one
// turns stones over to spell HAVE, the House of the Faun's greeting, then the wall parts.
export class ThresholdScene {
    width = WALL_W;
    height = VH;

    constructor({ calm }) {
        this.still = calm;
        this.debris = new Debris();
        this.lamp = new Lamp(WALL_W, WALL_H);
        this.phase = "idle";
        this.clock = 0;
        this.shake = 0;
        this.open = 0;
        this.name = "";
        this.onOpened = null;
        this.tiles = [];
        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                const i = row * COLS + col;
                const hx = (col + 0.5) * CELL;
                const hy = (row + 0.5) * CELL;
                const edge = col === 0 || row === 0 || col === COLS - 1 || row === ROWS - 1;
                this.tiles.push({
                    i,
                    col,
                    hx,
                    hy,
                    x: hx,
                    y: hy,
                    vx: 0,
                    vy: 0,
                    rot: 0,
                    vr: 0,
                    state: "set",
                    face: 0,
                    fv: 0,
                    goal: 0,
                    delay: 0,
                    word: inWord(col, row),
                    edge,
                    cut: cutFor(i, 2.4),
                });
            }
        }
    }

    fail() {
        if (this.phase !== "idle" && this.phase !== "failed") return;
        this.phase = "failed";
        this.clock = 0;
        this.shake = 1;
        for (const t of this.tiles) {
            if (t.state !== "set" || this.still || Math.random() > 0.13) continue;
            t.state = "loose";
            t.vx = (Math.random() - 0.5) * 200;
            t.vy = -100 - Math.random() * 160;
            t.vr = (Math.random() - 0.5) * 16;
        }
    }

    mend() {
        for (const t of this.tiles) {
            if (t.state !== "loose") continue;
            t.state = "return";
            t.delay = rank(t.i) * 0.35;
        }
    }

    succeed(name, onOpened) {
        this.mend();
        this.phase = "greeting";
        this.clock = 0;
        this.name = name;
        this.onOpened = onOpened;
        for (const t of this.tiles) {
            t.goal = t.word || t.edge ? 1 : 0;
            t.delay = Math.max(t.delay, 0.1 + t.col * 0.022 + rank(t.i + 4) * 0.05);
        }
    }

    pointer(x, y) {
        this.lamp.aim(x, y);
    }

    step(dt) {
        this.clock += dt;
        this.shake = Math.max(0, this.shake - dt * 2.6);
        this.lamp.step(dt);
        if (this.phase === "greeting" && this.clock > GREETING_SECONDS) {
            this.phase = "open";
            this.clock = 0;
        }
        if (this.phase === "open") {
            this.open = easeOut(this.clock / PART_SECONDS);
            if (this.clock > PART_SECONDS && this.onOpened) {
                const opened = this.onOpened;
                this.onOpened = null;
                opened();
            }
        }
        for (const t of this.tiles) this.move(t, dt);
        this.debris.step(dt);
    }

    move(t, dt) {
        if (t.state === "loose") {
            t.vy += 1100 * dt;
            t.x += t.vx * dt;
            t.y += t.vy * dt;
            t.rot += t.vr * dt;
            if (t.x < CELL / 2 || t.x > WALL_W - CELL / 2) t.vx *= -0.6;
            t.x = Math.max(CELL / 2, Math.min(WALL_W - CELL / 2, t.x));
            if (t.y > FLOOR - CELL / 2) {
                t.y = FLOOR - CELL / 2;
                t.vy *= -0.32;
                t.vx *= 0.6;
                t.vr *= 0.5;
                if (Math.abs(t.vy) < 40) t.vy = 0;
            }
        } else if (t.state === "return") {
            t.delay -= dt;
            if (t.delay > 0) return;
            t.vx += ((t.hx - t.x) * 130 - t.vx * 15) * dt;
            t.vy += ((t.hy - t.y) * 130 - t.vy * 15) * dt;
            t.x += t.vx * dt;
            t.y += t.vy * dt;
            t.rot += (Math.round(t.rot / (Math.PI / 2)) * (Math.PI / 2) - t.rot) * (1 - Math.exp(-9 * dt));
            if (Math.hypot(t.hx - t.x, t.hy - t.y) < 0.8 && Math.hypot(t.vx, t.vy) < 16) {
                t.state = "set";
                t.x = t.hx;
                t.y = t.hy;
                t.rot = 0;
                this.debris.dust(t.hx, t.hy);
            }
        } else if (this.still) {
            t.face = t.goal;
        } else if (t.delay > 0) {
            t.delay -= dt;
        } else {
            const before = t.face;
            t.fv += ((t.goal - t.face) * 180 - t.fv * 16) * dt;
            t.face += t.fv * dt;
            if (before < 0.5 && t.face >= 0.5 && t.word && Math.random() < 0.35) this.debris.spark(t.hx, t.hy, 3, 0, 120);
        }
    }

    drawBehind(g) {
        g.fillStyle = "#1c1f24";
        g.fillRect(0, 0, WALL_W, WALL_H);
        g.fillStyle = "#34383f";
        for (let y = 12; y < WALL_H; y += 16) for (let x = 12; x < WALL_W; x += 16) g.fillRect(x, y, 1.2, 1.2);
        const notes = [
            ["#ffd98a", -110, 36, -0.06],
            ["#b9d8c2", 18, 52, 0.05],
            ["#f6a97a", 120, 34, -0.03],
        ];
        for (const [color, dx, dy, tilt] of notes) {
            g.save();
            g.translate(WALL_W / 2 + dx, WALL_H / 2 + dy);
            g.rotate(tilt);
            g.globalAlpha = 0.9 * this.open;
            g.fillStyle = color;
            g.fillRect(-36, -26, 72, 52);
            g.restore();
        }
        g.globalAlpha = this.open;
        const greeting = this.name ? `Welcome back, ${this.name}.` : "Welcome back.";
        g.font = "800 22px Zodiak, Georgia, serif";
        const fit = Math.min(22, (22 * (WALL_W - 40)) / g.measureText(greeting).width);
        g.font = `800 ${fit}px Zodiak, Georgia, serif`;
        g.fillStyle = "#ecebe6";
        g.textAlign = "center";
        g.fillText(greeting, WALL_W / 2, 48);
        g.textAlign = "left";
        g.globalAlpha = 1;
    }

    draw(g) {
        g.clearRect(0, 0, WALL_W, VH);
        if (this.open > 0) this.drawBehind(g);
        const sx = Math.sin(this.clock * 58) * 9 * this.shake * this.shake;
        const gap = (this.open * WALL_W) / 2;
        if (this.open < 1) {
            g.fillStyle = "#0f1114";
            g.fillRect(sx - gap, 0, WALL_W / 2, WALL_H);
            g.fillRect(WALL_W / 2 + sx + gap, 0, WALL_W / 2, WALL_H);
        }
        const loose = [];
        for (const t of this.tiles) {
            if (t.state !== "set") {
                loose.push(t);
                continue;
            }
            const side = t.col < COLS / 2 ? -1 : 1;
            const x = t.hx + sx + side * this.open * WALL_W * 0.58;
            const turn = Math.cos(t.face * Math.PI);
            const gold = turn < 0;
            const lift = Math.sin(Math.max(0, Math.min(1, t.face)) * Math.PI) * 5;
            const near = this.lamp.nearness(x, t.hy, 130);
            const color = gold ? (t.word ? GOLD[t.i % 4] : "#c07d1c") : STONE[t.i % 4];
            const glint = gold ? Math.pow(Math.abs(Math.sin(t.face * Math.PI)), 6) * 0.5 : 0;
            drawStone(g, {
                x,
                y: t.hy - lift,
                half: CELL / 2 - 1.2,
                cut: t.cut,
                color,
                shine: near * near * (gold ? 0.6 : 0.12) + glint,
                scaleY: Math.max(0.05, Math.abs(turn)),
            });
        }
        for (const t of loose) {
            if (t.state === "return") {
                g.fillStyle = "rgba(236,235,230,.08)";
                g.fillRect(t.hx - 3, t.hy - 3, 6, 6);
            }
            drawStone(g, { x: t.x + (t.state === "loose" ? 0 : sx), y: t.y, half: CELL / 2 - 1.2, cut: t.cut, color: STONE[t.i % 4], rot: t.rot, shine: 0.05 });
        }
        this.lamp.draw(g, 160, 0.1);
        this.debris.draw(g);
    }
}
