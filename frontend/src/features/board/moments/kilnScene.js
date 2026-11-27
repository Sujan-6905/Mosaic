import { cutFor, easeOut } from "@/components/stoneScene/stones";

const VW = 1200;
const VH = 560;
const N = 30;
const KILN = { x: 14, y: 52, w: VW - 28 };
const PAD = { x: 0, y: 128, w: VW, h: VH - 132 };

// Stone to dull red to ember to gold to white heat.
const RAMP = [
    [46, 51, 58],
    [122, 42, 20],
    [222, 88, 22],
    [255, 180, 60],
    [255, 240, 200],
];
const heatColor = (h) => {
    const p = Math.max(0, Math.min(0.999, h)) * (RAMP.length - 1);
    const a = RAMP[Math.floor(p)];
    const b = RAMP[Math.floor(p) + 1];
    const f = p - Math.floor(p);
    return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
};

function ghostDoodle() {
    const points = [];
    const cx = 260 + Math.random() * 680;
    const cy = PAD.y + 190 + Math.random() * 40;
    if (Math.random() < 0.5) {
        for (let n = 0; n <= 90; n += 1) {
            const a = n * 0.21;
            const r = 8 + n * 0.95;
            points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.9 });
        }
    } else {
        for (let n = 0; n <= 5; n += 1) {
            const a = -Math.PI / 2 + n * ((Math.PI * 4) / 5);
            const b = -Math.PI / 2 + (n + 1) * ((Math.PI * 4) / 5);
            for (let k = 0; k < 12; k += 1) {
                const f = k / 12;
                points.push({ x: cx + (Math.cos(a) * (1 - f) + Math.cos(b) * f) * 84, y: cy + (Math.sin(a) * (1 - f) + Math.sin(b) * f) * 84 });
            }
        }
    }
    return points;
}

// The cold-start wait: tiles heat from stone to gold as the server wakes, and the pad takes ink that cools
// to gold. Until someone draws, a ghost hand doodles to show it can.
export class KilnScene {
    width = VW;
    height = VH;

    constructor({ calm, onStroke }) {
        this.still = calm;
        this.onStroke = onStroke;
        this.t = 0;
        this.progress = 0;
        this.ready = -1;
        this.heat = Array.from({ length: N }, () => 0);
        this.cuts = Array.from({ length: N }, (_unused, n) => cutFor(n, 3));
        this.embers = [];
        this.strokes = [];
        this.live = null;
        this.ghost = null;
        this.idle = 1.4;
        this.aim = null;
        this.drew = false;
    }

    setProgress(progress) {
        this.progress = progress;
    }

    finish() {
        if (this.ready < 0) this.ready = 0;
    }

    begin(x, y, ghost) {
        this.live = { points: [{ x, y, w: 0.4, at: this.t }], ghost };
        this.strokes.push(this.live);
        if (this.strokes.length > 24) this.strokes.shift();
    }

    extend(x, y) {
        if (!this.live) return;
        const last = this.live.points[this.live.points.length - 1];
        const d = Math.hypot(x - last.x, y - last.y);
        if (d < 2.5) return;
        const px = Math.max(PAD.x + 8, Math.min(PAD.x + PAD.w - 8, x));
        const py = Math.max(PAD.y + 8, Math.min(PAD.y + PAD.h - 8, y));
        this.live.points.push({ x: px, y: py, w: last.w + (Math.max(0.35, 1 - d / 46) - last.w) * 0.35, at: this.t });
    }

    end() {
        const stroke = this.live;
        this.live = null;
        if (stroke && !stroke.ghost && stroke.points.length > 1) this.onStroke?.(stroke.points.map(({ x, y }) => ({ x, y })));
    }

    pointer(x, y, event) {
        this.aim = [x, y];
        if (event.type === "pointerdown") {
            if (y < PAD.y || y > PAD.y + PAD.h || this.ready >= 0) return;
            if (!this.drew) this.strokes = this.strokes.filter((stroke) => !stroke.ghost);
            this.drew = true;
            this.ghost = null;
            this.begin(x, y, false);
            event.target.setPointerCapture?.(event.pointerId);
        } else if (event.type === "pointermove") {
            if (this.live && !this.live.ghost) this.extend(x, y);
        } else if (event.type === "pointerup") {
            if (this.live && !this.live.ghost) this.end();
        }
    }

    leave() {
        this.aim = null;
    }

    step(dt) {
        this.t += dt;
        if (this.ready >= 0) this.ready += dt;
        for (let n = 0; n < N; n += 1) {
            let want = Math.max(0, Math.min(1, (this.progress * (N + 7) - n) / 7)) * 0.9;
            if (this.ready >= 0) want = 0.8 + Math.sin(this.t * 3 - n * 0.3) * 0.08;
            if (this.aim) {
                const x = KILN.x + (n + 0.5) * (KILN.w / N);
                want += Math.max(0, 1 - Math.hypot(x - this.aim[0], KILN.y - this.aim[1]) / 110) * 0.5 * (want > 0.05 ? 1 : 0.35);
            }
            this.heat[n] += (want - this.heat[n]) * (1 - Math.exp(-3 * dt));
            if (!this.still && this.heat[n] > 0.35 && Math.random() < this.heat[n] * dt * 5) {
                this.embers.push({
                    x: KILN.x + (n + Math.random()) * (KILN.w / N),
                    y: KILN.y - 14,
                    vx: (Math.random() - 0.5) * 22,
                    vy: -30 - Math.random() * 60,
                    life: 0,
                    span: 0.8 + Math.random() * 1.4,
                    size: 0.8 + Math.random() * 1.6,
                });
            }
        }
        for (const e of this.embers) {
            e.life += dt;
            e.vx += Math.sin(this.t * 3 + e.y * 0.05) * 30 * dt;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
        }
        this.embers = this.embers.filter((e) => e.life < e.span && e.y > -10);
        this.stepGhost(dt);
    }

    stepGhost(dt) {
        if (this.drew || this.still || this.ready >= 0) return;
        if (!this.live && !this.ghost) {
            this.idle -= dt;
            if (this.idle > 0) return;
            this.ghost = { points: ghostDoodle(), at: 0 };
            this.strokes = this.strokes.filter((stroke) => !stroke.ghost);
            this.begin(this.ghost.points[0].x, this.ghost.points[0].y, true);
        }
        if (!this.ghost || !this.live) return;
        this.ghost.at += dt * 46;
        const upTo = Math.min(this.ghost.points.length - 1, Math.floor(this.ghost.at));
        for (let n = this.live.points.length; n <= upTo; n += 1) this.extend(this.ghost.points[n].x, this.ghost.points[n].y);
        if (upTo >= this.ghost.points.length - 1) {
            this.ghost = null;
            this.end();
            this.idle = 2.6;
        }
    }

    drawKiln(g) {
        const step = KILN.w / N;
        g.fillStyle = "#0f1114";
        g.beginPath();
        g.roundRect(KILN.x - 14, KILN.y - 34, KILN.w + 28, 68, 12);
        g.fill();
        g.globalCompositeOperation = "lighter";
        for (let n = 0; n < N; n += 1) {
            const h = this.heat[n];
            if (h < 0.08) continue;
            const x = KILN.x + (n + 0.5) * step;
            const glow = g.createRadialGradient(x, KILN.y, 0, x, KILN.y, 60 + h * 50);
            glow.addColorStop(0, `rgba(255,${(90 + h * 110) | 0},${(20 + h * 60) | 0},${h * 0.34})`);
            glow.addColorStop(1, "rgba(255,120,30,0)");
            g.fillStyle = glow;
            g.fillRect(x - 120, KILN.y - 120, 240, 240);
        }
        g.globalCompositeOperation = "source-over";
        for (let n = 0; n < N; n += 1) {
            const h = this.heat[n];
            const x = KILN.x + (n + 0.5) * step;
            const half = step / 2 - 3;
            const wobble = h > 0.3 && !this.still ? Math.sin(this.t * 9 + n * 1.7) * h * 0.8 : 0;
            const j = this.cuts[n];
            g.save();
            g.translate(x, KILN.y + wobble);
            g.beginPath();
            g.moveTo(-half + j[0], -22 + j[1]);
            g.lineTo(half + j[2], -22 + j[3]);
            g.lineTo(half + j[4], 22 + j[5]);
            g.lineTo(-half + j[6], 22 + j[7]);
            g.closePath();
            g.fillStyle = heatColor(h);
            g.fill();
            g.lineWidth = 1;
            g.strokeStyle = `rgba(255,255,255,${0.16 + h * 0.3})`;
            g.beginPath();
            g.moveTo(-half + j[6], 22 + j[7]);
            g.lineTo(-half + j[0], -22 + j[1]);
            g.lineTo(half + j[2], -22 + j[3]);
            g.stroke();
            g.restore();
        }
        g.globalCompositeOperation = "lighter";
        for (const e of this.embers) {
            const f = 1 - e.life / e.span;
            g.fillStyle = `rgba(255,${(140 + f * 100) | 0},60,${f})`;
            g.beginPath();
            g.arc(e.x, e.y, e.size * f + 0.3, 0, Math.PI * 2);
            g.fill();
        }
        g.globalCompositeOperation = "source-over";
    }

    drawPad(g) {
        const ready = this.ready >= 0;
        const lift = ready ? easeOut(this.ready / 0.8) : 0;
        g.save();
        g.translate(0, -lift * 8);
        g.shadowColor = `rgba(255,180,60,${lift * 0.35})`;
        g.shadowBlur = 60 * lift;
        g.fillStyle = "#1c1f24";
        g.strokeStyle = ready ? "#ffb43c" : "#2c3036";
        g.lineWidth = ready ? 2 : 1;
        g.beginPath();
        g.roundRect(PAD.x + 1, PAD.y, PAD.w - 2, PAD.h, 16);
        g.fill();
        g.stroke();
        g.shadowColor = "transparent";
        g.shadowBlur = 0;
        g.fillStyle = "#34383f";
        for (let y = PAD.y + 20; y < PAD.y + PAD.h - 8; y += 24) for (let x = PAD.x + 20; x < PAD.x + PAD.w - 8; x += 24) g.fillRect(x, y, 1.6, 1.6);
        if (!this.strokes.length) {
            g.fillStyle = "#868a92";
            g.font = "italic 400 26px Zodiak, Georgia, serif";
            g.textAlign = "center";
            g.fillText("Draw while it warms.", VW / 2, PAD.y + PAD.h / 2 + 8);
            g.textAlign = "left";
        }
        g.lineCap = "round";
        for (const s of this.strokes) {
            for (let n = 1; n < s.points.length; n += 1) {
                const p = s.points[n];
                const hot = this.still ? 0 : Math.max(0, 1 - (this.t - p.at) / 0.9);
                const fire = ready && !s.ghost ? Math.max(0, 1 - Math.abs(this.ready - 0.35 - ((p.x - PAD.x) / PAD.w) * 0.5) / 0.25) : 0;
                const glow = Math.max(hot, fire);
                if (glow > 0.05) {
                    g.globalCompositeOperation = "lighter";
                    g.strokeStyle = `rgba(255,150,50,${glow * 0.45})`;
                    g.lineWidth = p.w * 9 + 14;
                    g.beginPath();
                    g.moveTo(s.points[n - 1].x, s.points[n - 1].y);
                    g.lineTo(p.x, p.y);
                    g.stroke();
                    g.globalCompositeOperation = "source-over";
                }
                g.globalAlpha = s.ghost ? 0.55 : 1;
                g.strokeStyle = glow > 0.4 ? "#fff0c8" : "#ffb43c";
                g.lineWidth = p.w * 8 + 2;
                g.beginPath();
                g.moveTo(s.points[n - 1].x, s.points[n - 1].y);
                g.lineTo(p.x, p.y);
                g.stroke();
                g.globalAlpha = 1;
            }
        }
        g.restore();
    }

    draw(g) {
        g.clearRect(0, 0, VW, VH);
        this.drawKiln(g);
        this.drawPad(g);
    }
}
