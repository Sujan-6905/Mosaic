import { MIN_PASSWORD_LENGTH } from "@/lib/passwordStrength";
import { Debris, Lamp, cutFor, drawStone, isGilt, rank } from "@/components/stoneScene/stones";

const W = 24;
const H = 18;
const CELL = 16.5;
const VW = W * CELL;
const VH = H * CELL;

// Inner 22 x 16 picture: # body, e eye, c collar, k chain, r wall ring, g threshold.
const DOG = [
    ".......rr.......#..#..",
    "...#.....k......####..",
    "..##......k....######.",
    "..##.......k...###e###",
    "..##........k..#######",
    "..###########ccc#.##..",
    "...##############.....",
    "...##############.....",
    "...##############.....",
    "...##############.....",
    "....####......####....",
    "....###........###....",
    "....##.........##.....",
    "....##.........##.....",
    "....###........###....",
    "gggggggggggggggggggggg",
];
const BONE = ["#d8d4c6", "#cfcaba", "#e2ded1"];
const FIELD = ["#24282e", "#2a2e35", "#2e333a"];
const CHALK = "rgba(236,235,230,.1)";
const MORTAR = "rgba(236,235,230,.035)";
const isDog = (mark) => mark === "#" || mark === "e" || mark === "c";

// The picture depends on the score and the length only, so it can never show what was typed.
function guardianCells(score, length) {
    const dogShare = score >= 2 ? 1 : score === 1 ? Math.min(0.55, 0.12 + length * 0.06) : 0;
    const over = length - MIN_PASSWORD_LENGTH;
    const fieldShare = score === 4 ? 1 : score === 3 ? Math.min(0.78, 0.5 + over * 0.03) : score === 2 ? Math.min(0.36, 0.14 + over * 0.03) : 0;
    const cells = [];
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            const i = y * W + x;
            const r = rank(i);
            const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
            const mark = border ? "b" : DOG[y - 1][x - 1];
            let laid = false;
            let color = MORTAR;
            if (border) {
                const corner = (x === 0 || x === W - 1) && (y === 0 || y === H - 1);
                if (score === 4) {
                    laid = true;
                    color = corner ? "#de5816" : (x + y) % 2 ? "#ffb43c" : "#c07d1c";
                } else if (score === 3) {
                    laid = true;
                    color = (x + y) % 2 ? "#3b4048" : "#2e333a";
                } else if (score === 2 && r < 0.4) {
                    laid = true;
                    color = "#2e333a";
                }
            } else if (isDog(mark)) {
                if (r < dogShare) {
                    laid = true;
                    color = BONE[i % 3];
                    if (mark === "c" && score >= 3) color = "#de5816";
                    if (mark === "e") color = score >= 3 ? "#ffb43c" : "#8f8a7c";
                } else color = CHALK;
            } else if (mark === "k") {
                if (score >= 3) {
                    laid = true;
                    color = x % 2 ? "#e09a2c" : "#c07d1c";
                }
            } else if (mark === "r") {
                if (score >= 3) {
                    laid = true;
                    color = "#868a92";
                }
            } else if (mark === "g") {
                if (score >= 2) {
                    laid = true;
                    color = x % 2 ? "#d8d4c6" : "#3b4048";
                } else if (score === 1 && r < dogShare) {
                    laid = true;
                    color = "#3b4048";
                }
            } else if (r < fieldShare) {
                laid = true;
                color = FIELD[i % 3];
            }
            cells.push({ color, laid, r, mark });
        }
    }
    return cells;
}

// Clockwise position of a border cell, so gilding can run round the frame.
const perimeter = (x, y) => {
    if (y === 0) return x;
    if (x === W - 1) return W - 1 + y;
    if (y === H - 1) return W - 1 + H - 1 + (W - 1 - x);
    return 2 * (W - 1) + H - 1 + (H - 1 - y);
};
const PERIMETER = 2 * (W - 1) + 2 * (H - 1);

function paintBed() {
    const bed = document.createElement("canvas");
    bed.width = VW * 2;
    bed.height = VH * 2;
    const g = bed.getContext("2d");
    g.scale(2, 2);
    g.fillStyle = "#0f1114";
    g.fillRect(0, 0, VW, VH);
    for (let n = 0; n < 2600; n += 1) {
        const shade = rank(n * 3 + 1);
        g.fillStyle = shade > 0.5 ? "rgba(236,235,230,.035)" : "rgba(0,0,0,.28)";
        g.fillRect(rank(n) * VW, rank(n + 9000) * VH, 1 + shade, 1);
    }
    return bed;
}

// Each tessera is a body: sprung home, knocked out under gravity as the password weakens, and turned over
// in place when only its colour changes.
export class GuardianScene {
    width = VW;
    height = VH;

    constructor({ calm }) {
        this.still = calm;
        this.time = 0;
        this.score = 0;
        this.cells = guardianCells(0, 0);
        this.debris = new Debris();
        this.lamp = new Lamp(VW, VH);
        this.bark = 0;
        this.ring = -1;
        this.nextZ = 0;
        this.zs = [];
        this.bed = paintBed();
        this.tiles = [];
        for (let y = 0; y < H; y += 1) {
            for (let x = 0; x < W; x += 1) {
                const i = y * W + x;
                this.tiles.push({
                    i,
                    x,
                    y,
                    hx: (x + 0.5) * CELL,
                    hy: (y + 0.5) * CELL,
                    px: 0,
                    py: 0,
                    vx: 0,
                    vy: 0,
                    rot: 0,
                    vr: 0,
                    alpha: 0,
                    state: "off",
                    wait: 0,
                    color: null,
                    next: null,
                    flip: 0,
                    flipWait: 0,
                    squash: 0,
                    cut: cutFor(i, 2.6),
                    lane: perimeter(x, y),
                });
            }
        }
    }

    aim(score, length) {
        if (score === 4 && this.score !== 4 && !this.still) {
            this.bark = 1;
            this.ring = 0;
            for (const tile of this.tiles) {
                if (this.cells[tile.i].mark !== "b" || Math.random() > 0.55) continue;
                this.debris.spark(tile.hx, tile.hy, 1 + Math.random() * 2, tile.lane * 0.012);
            }
        }
        this.cells = guardianCells(score, length);
        this.score = score;
    }

    pointer(x, y) {
        this.lamp.aim(x, y);
    }

    step(dt) {
        this.time += dt;
        this.lamp.step(dt);
        this.bark = Math.max(0, this.bark - dt * 1.6);
        if (this.ring >= 0) {
            this.ring += dt * 1.5;
            if (this.ring > 1) this.ring = -1;
        }
        for (const tile of this.tiles) this.settle(tile, this.cells[tile.i], dt);
        if (this.score === 2 && this.time > this.nextZ && !this.still) {
            this.nextZ = this.time + 1.3;
            this.zs.push({ x: 19.5 * CELL, y: 2.2 * CELL, life: 0 });
        }
        for (const z of this.zs) {
            z.life += dt;
            z.x += 9 * dt;
            z.y -= 17 * dt;
        }
        this.zs = this.zs.filter((z) => z.life < 2.4);
        this.debris.step(dt);
    }

    settle(tile, cell, dt) {
        if (cell.laid) {
            if (tile.state === "off" || tile.state === "fall") {
                tile.state = "wait";
                tile.wait = cell.mark === "b" ? tile.lane * 0.007 : cell.r * 0.5;
                tile.color = cell.color;
                tile.next = null;
            } else if (tile.state === "set" && cell.color !== tile.color && tile.next !== cell.color) {
                if (this.still) tile.color = cell.color;
                else {
                    tile.next = cell.color;
                    tile.flip = 0;
                    tile.flipWait = cell.mark === "b" ? tile.lane * 0.011 : cell.r * 0.3;
                }
            }
        } else if (tile.state === "set" || tile.state === "fly") {
            if (this.still) {
                tile.state = "off";
                tile.alpha = 0;
            } else {
                tile.state = "fall";
                tile.vx = (Math.random() - 0.5) * 120;
                tile.vy = -70 - Math.random() * 110;
                tile.vr = (Math.random() - 0.5) * 14;
            }
        } else if (tile.state === "wait") tile.state = "off";

        if (tile.state === "wait") {
            tile.wait -= dt;
            if (tile.wait <= 0 || this.still) {
                tile.state = this.still ? "set" : "fly";
                tile.px = this.still ? tile.hx : tile.hx + (Math.random() - 0.5) * 170;
                tile.py = this.still ? tile.hy : -24 - Math.random() * 110;
                tile.rot = this.still ? 0 : (Math.random() - 0.5) * 5;
                tile.vx = 0;
                tile.vy = 0;
                tile.alpha = 1;
            }
        } else if (tile.state === "fly") {
            tile.vx += ((tile.hx - tile.px) * 150 - tile.vx * 17) * dt;
            tile.vy += ((tile.hy - tile.py) * 150 - tile.vy * 17) * dt;
            tile.px += tile.vx * dt;
            tile.py += tile.vy * dt;
            tile.rot *= Math.exp(-7 * dt);
            if (Math.abs(tile.hx - tile.px) + Math.abs(tile.hy - tile.py) < 0.7 && Math.abs(tile.vx) + Math.abs(tile.vy) < 14) {
                tile.state = "set";
                tile.px = tile.hx;
                tile.py = tile.hy;
                tile.rot = 0;
                tile.squash = 1;
                this.debris.dust(tile.hx, tile.hy + CELL * 0.4);
                if (isGilt(tile.color) && Math.random() < 0.3) this.debris.spark(tile.hx, tile.hy, 2);
            }
        } else if (tile.state === "fall") {
            tile.vy += 620 * dt;
            tile.px += tile.vx * dt;
            tile.py += tile.vy * dt;
            tile.rot += tile.vr * dt;
            tile.alpha -= dt * 1.3;
            if (tile.alpha <= 0 || tile.py > VH + 30) {
                tile.state = "off";
                tile.alpha = 0;
            }
        } else if (tile.state === "set") {
            tile.squash = Math.max(0, tile.squash - dt * 5);
            if (!tile.next) return;
            if (tile.flipWait > 0) {
                tile.flipWait -= dt;
                return;
            }
            tile.flip += dt / 0.4;
            if (tile.flip >= 0.5 && tile.color !== tile.next) {
                tile.color = tile.next;
                if (isGilt(tile.color) && Math.random() < 0.5) this.debris.spark(tile.hx, tile.hy, 2);
            }
            if (tile.flip >= 1) {
                tile.next = null;
                tile.flip = 0;
            }
        }
    }

    // Where a set tile sits this frame once breath, tail and chain are applied.
    pose(tile, mark) {
        let x = tile.px;
        let y = tile.py;
        let turn = 0;
        if (this.still || this.score < 2 || tile.state !== "set") return { x, y, turn };
        const ix = tile.x - 1;
        const iy = tile.y - 1;
        const awake = this.score >= 3;
        const breath = Math.sin(this.time * (awake ? 2.3 : 1.25));
        if (isDog(mark)) {
            y -= breath * 1.1 * Math.max(0, (10 - iy) / 10);
            if (ix >= 15 && iy <= 5) {
                y -= breath * 0.7 + this.bark * Math.sin(this.bark * 14) * 4;
                x += this.bark * 2.5;
            }
            if (awake && ix <= 4 && iy <= 5) {
                const swing = Math.sin(this.time * (this.score === 4 ? 12 : 6.5)) * 0.24;
                const dx = tile.hx - 4.5 * CELL;
                const dy = tile.hy - 6.5 * CELL;
                x = 4.5 * CELL + dx * Math.cos(swing) - dy * Math.sin(swing);
                y = 6.5 * CELL + dx * Math.sin(swing) + dy * Math.cos(swing) - breath * 0.6;
                turn = swing;
            }
        } else if (mark === "k") {
            x += Math.sin(this.time * 2.1 + iy * 0.9) * 1.1;
            y -= breath * 0.5;
        }
        return { x, y, turn };
    }

    stone(tile, x, y, turn, color, shine) {
        const flip = tile.next && tile.flipWait <= 0 ? Math.abs(Math.cos(tile.flip * Math.PI)) : 1;
        drawStone(this.g, {
            x,
            y,
            half: CELL / 2 - 1.2,
            cut: tile.cut,
            color,
            rot: tile.rot + turn,
            scaleX: (1 + tile.squash * 0.16) * Math.max(0.04, flip),
            scaleY: 1 - tile.squash * 0.2,
            alpha: tile.alpha,
            shine,
        });
    }

    draw(g) {
        this.g = g;
        g.drawImage(this.bed, 0, 0, VW, VH);
        const lamp = this.lamp;

        // Chalk underdrawing wherever the dog is not laid yet.
        g.lineCap = "round";
        for (const tile of this.tiles) {
            if (tile.state === "set" || tile.state === "fly") continue;
            if (isDog(this.cells[tile.i].mark)) {
                g.strokeStyle = `rgba(236,235,230,${0.13 + lamp.nearness(tile.hx, tile.hy, 120) * 0.3})`;
                g.lineWidth = 1.3;
                g.beginPath();
                g.moveTo(tile.hx - 3 + tile.cut[0], tile.hy + 2.5 + tile.cut[1]);
                g.lineTo(tile.hx + 3 + tile.cut[2], tile.hy - 2.5 + tile.cut[3]);
                g.stroke();
            } else {
                g.fillStyle = "rgba(236,235,230,.05)";
                g.fillRect(tile.hx - 0.8, tile.hy - 0.8, 1.6, 1.6);
            }
        }

        const blink = this.score >= 3 && this.time % 4.3 < 0.14;
        const sweep = (this.time * 0.22) % 1;
        const airborne = [];
        for (const tile of this.tiles) {
            if (tile.state === "off" || tile.state === "wait") continue;
            if (tile.state !== "set") {
                airborne.push(tile);
                continue;
            }
            const cell = this.cells[tile.i];
            const at = this.pose(tile, cell.mark);
            const gilt = isGilt(tile.color);
            const near = lamp.nearness(at.x, at.y, 135);
            let shine = near * near * (gilt ? 0.62 : 0.12);
            if (gilt && cell.mark === "b") shine += Math.pow(Math.max(0, Math.cos((tile.lane / PERIMETER - sweep) * Math.PI * 2)), 14) * 0.5;
            this.stone(tile, at.x, at.y, at.turn, cell.mark === "e" && blink ? BONE[0] : tile.color, shine);
            if (cell.mark === "e" && this.score >= 3 && !blink) {
                const glow = g.createRadialGradient(at.x, at.y, 0, at.x, at.y, 15);
                glow.addColorStop(0, "rgba(255,190,80,.6)");
                glow.addColorStop(1, "rgba(255,190,80,0)");
                g.globalCompositeOperation = "lighter";
                g.fillStyle = glow;
                g.fillRect(at.x - 15, at.y - 15, 30, 30);
                g.globalCompositeOperation = "source-over";
            }
        }

        for (const tile of airborne) {
            if (tile.state === "fly") {
                const height = Math.min(1, Math.abs(tile.hy - tile.py) / 90);
                g.fillStyle = `rgba(0,0,0,${0.3 * (1 - height)})`;
                g.beginPath();
                g.ellipse(tile.hx + 2, tile.hy + 3, CELL * 0.42, CELL * 0.3, 0, 0, Math.PI * 2);
                g.fill();
            }
            this.stone(tile, tile.px, tile.py, 0, tile.color, 0);
        }

        lamp.draw(g, 150);
        if (this.ring >= 0) {
            g.strokeStyle = `rgba(255,190,80,${(1 - this.ring) * 0.55})`;
            g.lineWidth = 3 * (1 - this.ring) + 0.5;
            g.beginPath();
            g.arc(VW / 2, VH / 2, 20 + this.ring * 260, 0, Math.PI * 2);
            g.stroke();
        }
        this.debris.draw(g);
        for (const z of this.zs) {
            const fade = 1 - z.life / 2.4;
            g.fillStyle = `rgba(236,235,230,${Math.sin(fade * Math.PI) * 0.75})`;
            g.font = `italic 400 ${9 + (1 - fade) * 9}px Zodiak, Georgia, serif`;
            g.fillText("z", z.x + Math.sin(z.life * 3) * 4, z.y);
        }
    }
}
