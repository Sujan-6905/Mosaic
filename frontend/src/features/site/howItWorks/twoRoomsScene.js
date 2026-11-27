const VW = 1240;
const VH = 430;
const FONT = "'Hanken Grotesk', sans-serif";
const MONO = "'Azeret Mono', ui-monospace, monospace";
const SW = 430;
const SH = 300;
const SY = 48;
const NW = 120;
const NH = 86;
const SERVER = { x: VW / 2, y: SY + SH / 2 };
const MAX_LAG = 1.5;
const SIDES = [
    { key: "a", name: "Asha", color: "#ef4444", x: 0 },
    { key: "b", name: "Ravi", color: "#3b82f6", x: VW - SW },
];
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

// Each screen sends moves after its own lag, the server stamps arrivals with the next version, and a screen
// applies only newer versions, so whichever move reaches the server last is the one both keep.
export class TwoRoomsScene {
    width = VW;
    height = VH;

    constructor({ calm, onVerdict }) {
        this.still = calm;
        this.onVerdict = onVerdict;
        this.restart(SIDES.map((_side, n) => (n === 0 ? 0.12 : 0.9)));
    }

    // Back to v41 with the note at rest, keeping whatever lag each side was given.
    restart(lags = this.sides.map((side) => side.lag)) {
        this.t = 0;
        this.server = { x: 0.3, y: 0.4, v: 41, by: "a", flash: 0 };
        this.sides = SIDES.map((side, n) => ({
            ...side,
            n,
            nx: 0.3,
            ny: 0.4,
            tx: 0.3,
            ty: 0.4,
            v: 41,
            lag: lags[n],
            drag: false,
            sent: 0,
            pulse: 0,
            ghost: null,
        }));
        this.packets = [];
        this.log = [{ text: "v41 Asha", color: "#ef4444" }];
        this.user = 0;
        this.nextGhost = 1.4;
        this.grab = null;
        this.lastVerdict = "";
    }

    // Both screens drag the note to different places at the same moment.
    race() {
        this.nextGhost = 6.5;
        this.sides.forEach((side, n) => {
            side.ghost = { fx: side.nx, fy: side.ny, tx: 0.08 + Math.random() * 0.84, ty: 0.08 + Math.random() * 0.84, at: -n * 0.25 };
        });
    }

    send(side) {
        side.sent = this.t;
        this.packets.push({ kind: "up", from: side.n, x: side.tx, y: side.ty, born: this.t, span: Math.max(0.12, side.lag), color: side.color });
    }

    arriveAtServer(packet) {
        const server = this.server;
        server.v += 1;
        server.x = packet.x;
        server.y = packet.y;
        server.by = this.sides[packet.from].key;
        server.flash = 1;
        this.log.unshift({ text: `v${server.v} ${this.sides[packet.from].name}`, color: packet.color });
        if (this.log.length > 5) this.log.pop();
        for (const side of this.sides)
            this.packets.push({
                kind: "down",
                from: packet.from,
                to: side.n,
                x: packet.x,
                y: packet.y,
                v: server.v,
                born: this.t,
                span: Math.max(0.12, side.lag),
                color: packet.color,
            });
    }

    arriveAtSide(packet) {
        const side = this.sides[packet.to];
        if (packet.v <= side.v) return;
        side.v = packet.v;
        if (side.drag) return;
        side.tx = packet.x;
        side.ty = packet.y;
        side.pulse = 1;
    }

    noteBox(side) {
        return { x: side.x + side.nx * (SW - NW), y: SY + side.ny * (SH - NH) };
    }

    slider(side) {
        return { x: side.x + 110, y: SY + SH + 50, w: SW - 180 };
    }

    setLag(side, x) {
        const track = this.slider(side);
        side.lag = Math.max(0.02, Math.min(MAX_LAG, ((x - track.x) / track.w) * MAX_LAG));
    }

    pointer(x, y, event) {
        if (event.type === "pointerdown") {
            this.user = 20;
            for (const side of this.sides) {
                const box = this.noteBox(side);
                if (x > box.x && x < box.x + NW && y > box.y && y < box.y + NH) {
                    this.grab = { side, kind: "note", dx: x - box.x, dy: y - box.y };
                    side.drag = true;
                    side.ghost = null;
                    event.target.setPointerCapture?.(event.pointerId);
                    return;
                }
                const track = this.slider(side);
                if (x > track.x - 16 && x < track.x + track.w + 16 && Math.abs(y - track.y) < 24) {
                    this.grab = { side, kind: "lag" };
                    this.setLag(side, x);
                    event.target.setPointerCapture?.(event.pointerId);
                    return;
                }
            }
        } else if (event.type === "pointermove" && this.grab) {
            this.user = 20;
            const { side } = this.grab;
            if (this.grab.kind === "lag") {
                this.setLag(side, x);
                return;
            }
            side.tx = Math.max(0, Math.min(1, (x - this.grab.dx - side.x) / (SW - NW)));
            side.ty = Math.max(0, Math.min(1, (y - this.grab.dy - SY) / (SH - NH)));
            side.nx = side.tx;
            side.ny = side.ty;
            if (this.t - side.sent > 0.14) this.send(side);
        } else if (event.type === "pointerup" && this.grab) {
            const { side, kind } = this.grab;
            if (kind === "note") {
                side.drag = false;
                this.send(side);
            }
            this.grab = null;
        }
    }

    // What is happening, in a sentence, for the caption under the canvas.
    verdict() {
        const server = this.server;
        const settled = this.sides.every((side) => side.v === server.v && !side.drag) && this.packets.length === 0;
        if (settled)
            return {
                settled,
                text: `Both screens agree on v${server.v}. It was ${this.sides.find((side) => side.key === server.by).name}'s, because it reached the server last.`,
            };
        const inFlight = this.packets.filter((packet) => packet.kind === "up").length;
        return {
            settled,
            text: inFlight
                ? `${inFlight === 1 ? "A move is" : `${inFlight} moves are`} on the way to the server. Whatever arrives last becomes v${server.v + inFlight}.`
                : `The server holds v${server.v}. Each screen takes it once its lag lets the update through.`,
        };
    }

    step(dt) {
        this.t += dt;
        this.user = Math.max(0, this.user - dt);
        if (this.user <= 0 && !this.still) {
            this.nextGhost -= dt;
            if (this.nextGhost <= 0) this.race();
        }
        for (const side of this.sides) {
            if (side.ghost) {
                side.ghost.at += dt / 0.9;
                if (side.ghost.at > 0) {
                    const f = ease(side.ghost.at);
                    side.drag = true;
                    side.tx = side.ghost.fx + (side.ghost.tx - side.ghost.fx) * f;
                    side.ty = side.ghost.fy + (side.ghost.ty - side.ghost.fy) * f;
                    side.nx = side.tx;
                    side.ny = side.ty;
                    if (this.t - side.sent > 0.14) this.send(side);
                    if (side.ghost.at >= 1) {
                        side.drag = false;
                        side.ghost = null;
                        this.send(side);
                    }
                }
            }
            side.nx += (side.tx - side.nx) * (1 - Math.exp(-14 * dt));
            side.ny += (side.ty - side.ny) * (1 - Math.exp(-14 * dt));
            side.pulse = Math.max(0, side.pulse - dt * 2.2);
        }
        this.server.flash = Math.max(0, this.server.flash - dt * 3);
        for (const packet of this.packets) {
            if (packet.done || this.t - packet.born < packet.span) continue;
            packet.done = true;
            if (packet.kind === "up") this.arriveAtServer(packet);
            else this.arriveAtSide(packet);
        }
        this.packets = this.packets.filter((packet) => !packet.done);
        const { text, settled } = this.verdict();
        if (text !== this.lastVerdict) {
            this.lastVerdict = text;
            this.onVerdict?.(text, settled);
        }
    }

    wire(side) {
        const inner = side.n === 0 ? side.x + SW : side.x;
        return { x1: inner, x2: SERVER.x + (side.n === 0 ? -100 : 100), y: SERVER.y };
    }

    drawScreen(g, side) {
        const wire = this.wire(side);
        g.strokeStyle = "#2c3036";
        g.lineWidth = 2;
        g.setLineDash([3, 7]);
        g.beginPath();
        g.moveTo(wire.x1, wire.y - 14);
        g.lineTo(wire.x2, wire.y - 14);
        g.moveTo(wire.x1, wire.y + 14);
        g.lineTo(wire.x2, wire.y + 14);
        g.stroke();
        g.setLineDash([]);

        g.fillStyle = "#1c1f24";
        g.strokeStyle = side.drag ? side.color : "#2c3036";
        g.lineWidth = side.drag ? 2 : 1;
        g.beginPath();
        g.roundRect(side.x, SY, SW, SH, 14);
        g.fill();
        g.stroke();
        g.save();
        g.beginPath();
        g.roundRect(side.x, SY, SW, SH, 14);
        g.clip();
        g.fillStyle = "#31353c";
        for (let y = SY + 16; y < SY + SH; y += 22) for (let x = side.x + 16; x < side.x + SW; x += 22) g.fillRect(x, y, 1.5, 1.5);
        const box = this.noteBox(side);
        const lift = side.drag ? 4 : 0;
        if (side.pulse > 0) {
            const grow = 1 - side.pulse;
            g.strokeStyle = `rgba(255,180,60,${side.pulse})`;
            g.lineWidth = 2;
            g.beginPath();
            g.roundRect(box.x - 10 * grow - 4, box.y - 10 * grow - 4, NW + 20 * grow + 8, NH + 20 * grow + 8, 8);
            g.stroke();
        }
        g.shadowColor = "rgba(0,0,0,.45)";
        g.shadowBlur = side.drag ? 30 : 14;
        g.shadowOffsetY = side.drag ? 16 : 6;
        g.fillStyle = "#ffd98a";
        g.beginPath();
        g.roundRect(box.x, box.y - lift, NW, NH, 4);
        g.fill();
        g.shadowColor = "transparent";
        g.shadowBlur = 0;
        g.shadowOffsetY = 0;
        g.fillStyle = "#1a1206";
        g.font = `600 15px ${FONT}`;
        g.fillText("Launch", box.x + 14, box.y + 30 - lift);
        g.fillText("date?", box.x + 14, box.y + 50 - lift);
        g.fillStyle = "rgba(26,18,6,.7)";
        g.font = `500 11px ${MONO}`;
        g.fillText(`v${side.v}`, box.x + NW - 36, box.y + NH - 12 - lift);
        g.restore();

        g.fillStyle = side.color;
        g.beginPath();
        g.roundRect(side.x, SY - 40, 26, 26, 6);
        g.fill();
        g.fillStyle = "#fff";
        g.font = `700 13px ${FONT}`;
        g.fillText(side.name[0], side.x + 8.5, SY - 22);
        g.fillStyle = "#ecebe6";
        g.font = `600 16px ${FONT}`;
        g.fillText(`${side.name}'s screen`, side.x + 36, SY - 21);
        g.fillStyle = side.v === this.server.v ? "#868a92" : "#ffb43c";
        g.font = `400 12px ${MONO}`;
        g.textAlign = "right";
        g.fillText(side.v === this.server.v ? "UP TO DATE" : `HOLDS V${side.v}`, side.x + SW, SY - 21);
        g.textAlign = "left";

        const track = this.slider(side);
        const k = side.lag / MAX_LAG;
        g.fillStyle = "#a4a7ae";
        g.font = `400 14px ${FONT}`;
        g.fillText(`${side.name}'s lag`, side.x, track.y + 5);
        g.fillStyle = "#2e333a";
        g.beginPath();
        g.roundRect(track.x, track.y - 3, track.w, 6, 3);
        g.fill();
        g.fillStyle = side.color;
        g.beginPath();
        g.roundRect(track.x, track.y - 3, track.w * k, 6, 3);
        g.fill();
        g.fillStyle = "#ecebe6";
        g.beginPath();
        g.roundRect(track.x + track.w * k - 9, track.y - 11, 18, 22, 5);
        g.fill();
        g.font = `500 12px ${MONO}`;
        g.textAlign = "right";
        g.fillText(`${Math.round(side.lag * 1000)} MS`, side.x + SW, track.y + 5);
        g.textAlign = "left";
    }

    drawServer(g) {
        const server = this.server;
        g.shadowColor = `rgba(255,180,60,${server.flash * 0.6})`;
        g.shadowBlur = 40 * server.flash;
        g.fillStyle = "#24282e";
        g.strokeStyle = server.flash > 0.05 ? "#ffb43c" : "#3b4048";
        g.lineWidth = 1.5;
        g.beginPath();
        g.roundRect(SERVER.x - 100, SY, 200, SH, 14);
        g.fill();
        g.stroke();
        g.shadowColor = "transparent";
        g.shadowBlur = 0;
        g.fillStyle = "#868a92";
        g.font = `400 11px ${MONO}`;
        g.fillText("SERVER", SERVER.x - 80, SY + 30);
        g.fillStyle = "#ffb43c";
        g.font = "800 50px Zodiak, Georgia, serif";
        g.fillText(`v${server.v}`, SERVER.x - 82, SY + 84);
        this.log.forEach((line, n) => {
            g.globalAlpha = Math.max(0.25, 1 - n * 0.18);
            g.fillStyle = line.color;
            g.fillRect(SERVER.x - 80, SY + 116 + n * 32, 8, 8);
            g.fillStyle = "#ecebe6";
            g.font = `400 12px ${MONO}`;
            g.fillText(line.text, SERVER.x - 64, SY + 124 + n * 32);
        });
        g.globalAlpha = 1;
    }

    drawPackets(g) {
        for (const packet of this.packets) {
            const f = Math.min(1, (this.t - packet.born) / packet.span);
            const side = this.sides[packet.kind === "up" ? packet.from : packet.to];
            const wire = this.wire(side);
            const k = packet.kind === "up" ? f : 1 - f;
            const x = wire.x1 + (wire.x2 - wire.x1) * k;
            const y = wire.y + (packet.kind === "up" ? -14 : 14);
            g.globalCompositeOperation = "lighter";
            const glow = g.createRadialGradient(x, y, 0, x, y, 16);
            glow.addColorStop(0, packet.color);
            glow.addColorStop(1, "rgba(0,0,0,0)");
            g.globalAlpha = 0.6;
            g.fillStyle = glow;
            g.fillRect(x - 16, y - 16, 32, 32);
            g.globalAlpha = 1;
            g.globalCompositeOperation = "source-over";
            g.fillStyle = packet.color;
            g.beginPath();
            g.roundRect(x - 5, y - 5, 10, 10, 2);
            g.fill();
            // Only the newest update heading to a screen is labelled, so a backlog stays readable.
            if (packet.kind === "down" && !this.packets.some((other) => other.kind === "down" && other.to === packet.to && other.v > packet.v)) {
                g.fillStyle = "#ecebe6";
                g.font = `500 10px ${MONO}`;
                g.fillText(`v${packet.v}`, x - 9, y + 22);
            }
        }
    }

    draw(g) {
        g.clearRect(0, 0, VW, VH);
        for (const side of this.sides) this.drawScreen(g, side);
        this.drawServer(g);
        this.drawPackets(g);
    }
}
