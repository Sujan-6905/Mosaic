import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { cameraToFit } from "../camera/viewport";
import { GOLD } from "@/components/stoneScene/stones";

const SIZE = { width: 1280, height: 720 };
const SECONDS = 20;
const END_CARD_SECONDS = 2.5;
const FPS = 30;
const CAPTION_BAND = 64;
const TYPES = [
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
    ["video/mp4", "mp4"],
];

export const timelapseSupported = () => typeof MediaRecorder !== "undefined" && TYPES.some(([type]) => MediaRecorder.isTypeSupported(type));

const fontOf = () => getComputedStyle(document.body).fontFamily || "sans-serif";

const drawCaption = (g, text, progress, font) => {
    const y = SIZE.height - CAPTION_BAND / 2;
    g.fillStyle = "rgba(21,23,27,.86)";
    g.fillRect(0, SIZE.height - CAPTION_BAND, SIZE.width, CAPTION_BAND);
    g.fillStyle = "#ffb43c";
    g.fillRect(0, SIZE.height - CAPTION_BAND, SIZE.width * progress, 3);
    g.textBaseline = "middle";
    g.font = `600 20px ${font}`;
    g.fillStyle = "#ecebe6";
    g.textAlign = "left";
    g.fillText(text.title, 32, y);
    g.font = `500 15px ${font}`;
    g.fillStyle = "#ffb43c";
    g.textAlign = "right";
    g.fillText(text.count, SIZE.width - 32, y);
};

const drawEndCard = (g, title, changes, fade, font) => {
    g.globalAlpha = fade;
    g.fillStyle = "#15171b";
    g.fillRect(0, 0, SIZE.width, SIZE.height);
    const tile = 26;
    const left = SIZE.width / 2 - (tile * 4 + 12) / 2;
    [1, 6, 8, 11].forEach((index, n) => {
        g.fillStyle = GOLD[n % GOLD.length];
        g.fillRect(left + (index % 4) * (tile + 4), 230 + Math.floor(index / 4) * (tile + 4), tile, tile);
    });
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#ecebe6";
    g.font = `700 44px ${font}`;
    g.fillText(title, SIZE.width / 2, 430, SIZE.width - 120);
    g.font = `400 20px ${font}`;
    g.fillStyle = "#a4a7ae";
    g.fillText(`${changes.toLocaleString("en-GB")} changes, made in Mosaic`, SIZE.width / 2, 474);
    g.globalAlpha = 1;
};

// Records the board's reel front to back as a video with a running count, then a closing card.
// `paint(g, elements, background, camera)` draws one frame the way the board does.
export function recordTimelapse({ frames, latestSeq, title, paint }) {
    const [type, extension] = TYPES.find(([candidate]) => MediaRecorder.isTypeSupported(candidate));
    const canvas = document.createElement("canvas");
    canvas.width = SIZE.width;
    canvas.height = SIZE.height;
    const g = canvas.getContext("2d");
    const font = fontOf();
    const bounds = getUnionBounds(frames.flatMap((frame) => Object.values(frame.elements)));
    const camera = cameraToFit(bounds, SIZE.width, SIZE.height - CAPTION_BAND, 60, { clamp: false }) ?? { x: 0, y: 0, zoom: 1 };
    const playSeconds = SECONDS - END_CARD_SECONDS;
    const name = title || "Untitled board";

    const recorder = new MediaRecorder(canvas.captureStream(FPS), { mimeType: type, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);

    return new Promise((resolve, reject) => {
        recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: type.split(";")[0] }), extension });
        recorder.onerror = (event) => reject(event.error ?? new Error("The recording stopped"));
        const start = performance.now();
        const tick = () => {
            const elapsed = (performance.now() - start) / 1000;
            const progress = Math.min(1, elapsed / playSeconds);
            const frame = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
            g.setTransform(1, 0, 0, 1, 0, 0);
            paint(g, frame.elements, frame.background, camera);
            g.setTransform(1, 0, 0, 1, 0, 0);
            drawCaption(g, { title: name, count: `${frame.seq.toLocaleString("en-GB")} of ${latestSeq.toLocaleString("en-GB")} changes` }, progress, font);
            if (elapsed > playSeconds) drawEndCard(g, name, latestSeq, Math.min(1, (elapsed - playSeconds) / 0.5), font);
            if (elapsed < SECONDS) setTimeout(tick, 1000 / FPS);
            else recorder.stop();
        };
        recorder.start(500);
        tick();
    });
}
