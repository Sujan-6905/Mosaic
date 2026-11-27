export const clamp01 = (value) => Math.max(0, Math.min(1, value));
export const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 4);

// Stable pseudo-random in [0, 1) per index, so a stone keeps its cut across renders.
export const rank = (index) => {
    const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
};

export const cutFor = (index, amount) => Array.from({ length: 8 }, (_unused, k) => (rank(index * 13 + k * 7 + 5) - 0.5) * amount);

// Grey stone for an unlit field, and the gold that marks a moment on it.
export const STONE = ["#24282e", "#2a2e35", "#2e333a", "#272b31"];
export const GOLD = ["#ffb43c", "#f2a631", "#e09a2c", "#ffbe55"];

const GILT = ["#ffb43c", "#c07d1c", "#e09a2c", "#de5816", "#f2a631", "#ffbe55"];
export const isGilt = (color) => GILT.includes(color);

// A hand-cut tessera: an irregular quad, lit on its top-left edges and shaded on the others.
export function drawStone(g, { x, y, half, cut, color, rot = 0, scaleX = 1, scaleY = 1, alpha = 1, shine = 0 }) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(scaleX, scaleY);
    g.globalAlpha = alpha;
    g.beginPath();
    g.moveTo(-half + cut[0], -half + cut[1]);
    g.lineTo(half + cut[2], -half + cut[3]);
    g.lineTo(half + cut[4], half + cut[5]);
    g.lineTo(-half + cut[6], half + cut[7]);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (shine > 0.01) {
        g.fillStyle = `rgba(255,247,224,${Math.min(0.85, shine)})`;
        g.fill();
    }
    g.lineWidth = 1;
    g.strokeStyle = "rgba(255,255,255,.2)";
    g.beginPath();
    g.moveTo(-half + cut[6], half + cut[7]);
    g.lineTo(-half + cut[0], -half + cut[1]);
    g.lineTo(half + cut[2], -half + cut[3]);
    g.stroke();
    g.strokeStyle = "rgba(0,0,0,.42)";
    g.beginPath();
    g.moveTo(half + cut[2], -half + cut[3]);
    g.lineTo(half + cut[4], half + cut[5]);
    g.lineTo(-half + cut[6], half + cut[7]);
    g.stroke();
    g.restore();
}

// Sparks fall and glow additively; dust drifts and settles. Both are cheap enough to spawn per stone.
export class Debris {
    constructor() {
        this.items = [];
    }

    spark(x, y, count, delay = 0, speed = 110) {
        for (let n = 0; n < count; n += 1) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = speed * (0.3 + Math.random() * 0.7);
            this.items.push({
                spark: true,
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - 40,
                life: -delay,
                span: 0.5 + Math.random() * 0.6,
                size: 0.8 + Math.random() * 1.5,
            });
        }
    }

    dust(x, y, count = 3) {
        for (let n = 0; n < count; n += 1) {
            this.items.push({
                spark: false,
                x,
                y,
                vx: (Math.random() - 0.5) * 46,
                vy: -8 - Math.random() * 26,
                life: 0,
                span: 0.35 + Math.random() * 0.3,
                size: 1 + Math.random() * 1.6,
            });
        }
    }

    step(dt) {
        for (const p of this.items) {
            p.life += dt;
            if (p.life < 0) continue;
            if (p.spark) p.vy += 260 * dt;
            else {
                p.vx *= Math.exp(-4 * dt);
                p.vy *= Math.exp(-4 * dt);
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        this.items = this.items.filter((p) => p.life < p.span);
    }

    draw(g) {
        g.globalCompositeOperation = "lighter";
        for (const p of this.items) {
            if (p.life < 0 || !p.spark) continue;
            const fade = 1 - p.life / p.span;
            g.fillStyle = `rgba(255,${170 + Math.floor(fade * 70)},70,${fade})`;
            g.beginPath();
            g.arc(p.x, p.y, p.size * fade + 0.3, 0, Math.PI * 2);
            g.fill();
        }
        g.globalCompositeOperation = "source-over";
        for (const p of this.items) {
            if (p.life < 0 || p.spark) continue;
            const fade = 1 - p.life / p.span;
            g.fillStyle = `rgba(214,208,192,${fade * 0.34})`;
            g.beginPath();
            g.arc(p.x, p.y, p.size + (1 - fade) * 3.5, 0, Math.PI * 2);
            g.fill();
        }
    }
}

// The light gold is seen by follows the visitor's own hour: pale at dawn, white by day, amber at dusk, moonlit at night.
const lightForHour = (hour) => {
    if (hour >= 5 && hour < 9) return "255,226,186";
    if (hour >= 9 && hour < 17) return "255,240,214";
    if (hour >= 17 && hour < 21) return "255,176,96";
    return "196,210,255";
};

// A pool of light that roams on its own and follows the pointer while it is near.
export class Lamp {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tint = lightForHour(new Date().getHours());
        this.x = width * 0.7;
        this.y = height * 0.3;
        this.held = 0;
        this.tx = 0;
        this.ty = 0;
        this.time = 0;
    }

    aim(x, y) {
        this.tx = x;
        this.ty = y;
        this.held = 2.5;
    }

    step(dt) {
        this.time += dt;
        this.held = Math.max(0, this.held - dt);
        const roamX = this.width / 2 + Math.cos(this.time * 0.45) * this.width * 0.4;
        const roamY = this.height / 2 + Math.sin(this.time * 0.7) * this.height * 0.34;
        const follow = 1 - Math.exp(-7 * dt);
        this.x += ((this.held > 0 ? this.tx : roamX) - this.x) * follow;
        this.y += ((this.held > 0 ? this.ty : roamY) - this.y) * follow;
    }

    nearness(x, y, radius) {
        return Math.max(0, 1 - Math.hypot(x - this.x, y - this.y) / radius);
    }

    draw(g, radius, strength = 0.13) {
        const pool = g.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius);
        pool.addColorStop(0, `rgba(${this.tint},${strength})`);
        pool.addColorStop(1, `rgba(${this.tint},0)`);
        g.globalCompositeOperation = "lighter";
        g.fillStyle = pool;
        g.fillRect(0, 0, this.width, this.height);
        g.globalCompositeOperation = "source-over";
    }
}
