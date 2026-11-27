import { drawSceneStatic } from "@/features/board/rendering/staticSceneRenderer";
import { getUnionBounds } from "../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "@/features/board/camera/viewport";
import { clamp01, easeOut } from "@/components/stoneScene/stones";

const WIDTH = 1440;
const HEIGHT = 900;
const BOARD = { x: 120, y: 350, width: 1200, height: 500 };
const WRITE_SECONDS = 2.3;
const NAME_AT = 2.4;
const NOTE_AT = 3.1;
const BOARD_AT = 4.4;
const BOARD_SECONDS = 9;
export const LETTER_SECONDS = BOARD_AT + BOARD_SECONDS + 1;

// Samples a cubic so the pen can travel along it.
const curve = (points, p0, p1, p2, p3, steps = 14) => {
    for (let n = points.length ? 1 : 0; n <= steps; n += 1) {
        const t = n / steps;
        const u = 1 - t;
        points.push({
            x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        });
    }
    return points;
};
const line = (a, b) =>
    curve([], a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3], b, 8);

// "Hello," as pen strokes, in the order a hand makes them.
const HELLO = (() => {
    const strokes = [line([0, -118], [4, 0]), line([62, -120], [64, 0]), curve([], [2, -58], [24, -66], [44, -52], [64, -62])];
    let e = curve([], [92, -38], [118, -40], [140, -52], [126, -70]);
    e = curve(e, [126, -70], [112, -86], [90, -66], [92, -38]);
    strokes.push(curve(e, [92, -38], [94, -6], [128, -2], [146, -20]));
    strokes.push(curve([], [172, -124], [168, -70], [168, -30], [182, -4]));
    strokes.push(curve([], [208, -124], [204, -70], [204, -30], [218, -4]));
    let o = curve([], [262, -70], [234, -70], [232, -2], [262, -2]);
    strokes.push(curve(o, [262, -2], [294, -2], [292, -72], [262, -70]));
    strokes.push(curve([], [314, -6], [318, 4], [314, 16], [304, 24], 6));
    let run = 0;
    for (const stroke of strokes) {
        stroke.from = run;
        let length = 0;
        for (let n = 1; n < stroke.length; n += 1) length += Math.hypot(stroke[n].x - stroke[n - 1].x, stroke[n].y - stroke[n - 1].y);
        stroke.length2d = length;
        run += length + 26;
    }
    strokes.total = run;
    return strokes;
})();

const drawPen = (g, x, y) => {
    g.save();
    g.translate(x, y);
    g.rotate(-0.6);
    g.fillStyle = "#ffb43c";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-7, -18);
    g.lineTo(7, -18);
    g.closePath();
    g.fill();
    g.fillStyle = "#ecebe6";
    g.fillRect(-7, -64, 14, 46);
    g.fillStyle = "#868a92";
    g.fillRect(-7, -70, 14, 8);
    g.restore();
};

// Writes the greeting up to `reach` of its length, returning where the nib is while it is still writing.
const drawHello = (g, reach, x, y) => {
    let nib = null;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#ffb43c";
    for (const stroke of HELLO) {
        const into = reach - stroke.from;
        if (into <= 0) continue;
        let run = 0;
        for (let n = 1; n < stroke.length; n += 1) {
            const segment = Math.hypot(stroke[n].x - stroke[n - 1].x, stroke[n].y - stroke[n - 1].y);
            if (run >= into) break;
            const f = Math.min(1, (into - run) / segment);
            const ax = x + stroke[n - 1].x;
            const ay = y + stroke[n - 1].y;
            const bx = ax + (stroke[n].x - stroke[n - 1].x) * f;
            const by = ay + (stroke[n].y - stroke[n - 1].y) * f;
            g.lineWidth = 5.2 + Math.sin(n * 0.8 + stroke.from) * 1.6;
            g.beginPath();
            g.moveTo(ax, ay);
            g.lineTo(bx, by);
            g.stroke();
            if (into < stroke.length2d) nib = [bx, by];
            run += segment;
        }
    }
    return nib;
};

// "Hello," written by a pen, the reader's name in gold, the sender's note typed out, then the board laying
// itself down from its history.
export function createLetterScene({ company, note, frames, latestSeq, calm, font }) {
    const camera = cameraToFit(getUnionBounds(frames.flatMap((frame) => Object.values(frame.elements))), BOARD.width, BOARD.height, 40, { clamp: false }) ?? {
        x: 0,
        y: 0,
        zoom: 1,
    };
    let time = calm ? LETTER_SECONDS : 0;
    let held = null;
    let playing = !calm;

    return {
        width: WIDTH,
        height: HEIGHT,
        get time() {
            return time;
        },
        get playing() {
            return playing;
        },
        seek(seconds) {
            held = Math.max(0, Math.min(LETTER_SECONDS, seconds));
            time = held;
            playing = false;
        },
        play() {
            if (time >= LETTER_SECONDS) time = 0;
            held = null;
            playing = true;
        },
        pause() {
            playing = false;
        },
        step(dt) {
            if (!playing) return;
            time = Math.min(LETTER_SECONDS, time + dt);
            if (time >= LETTER_SECONDS) playing = false;
        },
        draw(g) {
            const scale = g.getTransform().a;
            g.clearRect(0, 0, WIDTH, HEIGHT);
            g.fillStyle = "#2b2d31";
            for (let y = 20; y < HEIGHT; y += 24) for (let x = 20; x < WIDTH; x += 24) g.fillRect(x, y, 1.6, 1.6);

            const nib = drawHello(g, clamp01(time / WRITE_SECONDS) * HELLO.total, 150, 230);
            const slot = clamp01((time - NAME_AT) / 0.6);
            if (slot > 0) {
                g.globalAlpha = slot;
                g.fillStyle = "#ffb43c";
                g.font = `italic 400 64px ${font.display}`;
                g.fillText(company, 520, 210 + (1 - easeOut(slot)) * 12, WIDTH - 600);
                g.globalAlpha = 1;
            }
            if (note && time > NOTE_AT) {
                const typed = Math.floor(clamp01((time - NOTE_AT) / 1.2) * note.length);
                g.fillStyle = "#a4a7ae";
                g.font = `400 22px ${font.body}`;
                g.fillText(note.slice(0, typed), 150, 300, WIDTH - 300);
            }
            if (nib) drawPen(g, nib[0], nib[1]);

            const laid = clamp01((time - BOARD_AT) / BOARD_SECONDS);
            if (time > BOARD_AT - 0.3) {
                g.globalAlpha = clamp01((time - BOARD_AT + 0.3) / 0.3);
                g.fillStyle = "#1c1f24";
                g.strokeStyle = "#2c3036";
                g.lineWidth = 1.5;
                g.beginPath();
                g.roundRect(BOARD.x, BOARD.y, BOARD.width, BOARD.height, 16);
                g.fill();
                g.stroke();
                g.globalAlpha = 1;
                const frame = frames[Math.min(frames.length - 1, Math.floor(laid * frames.length))];
                g.save();
                g.beginPath();
                g.roundRect(BOARD.x, BOARD.y, BOARD.width, BOARD.height, 16);
                g.clip();
                drawSceneStatic(
                    g,
                    frame.elements,
                    null,
                    { x: camera.x - BOARD.x / camera.zoom, y: camera.y - BOARD.y / camera.zoom, zoom: camera.zoom * scale },
                    WIDTH * scale,
                    HEIGHT * scale,
                );
                g.restore();
                g.setTransform(scale, 0, 0, scale, 0, 0);
                g.fillStyle = "#ffb43c";
                g.fillRect(BOARD.x, BOARD.y + BOARD.height + 14, BOARD.width * laid, 3);
                g.fillStyle = "#868a92";
                g.font = `500 13px ${font.mono}`;
                g.fillText(`${frame.seq.toLocaleString("en-GB")} OF ${latestSeq.toLocaleString("en-GB")} CHANGES`, BOARD.x, BOARD.y + BOARD.height + 40);
            }
        },
    };
}
