import { readChoice, useChoiceSync, writeChoice } from "./browserChoice";

const STORAGE_KEY = "mosaic:sound";
const CHANGE_EVENT = "mosaic:sound-change";

let audio = null;
const context = () => {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    return audio;
};

// A struck ceramic body: a few inharmonic partials, each ringing out on its own decay.
const strike = (ctx, at, fundamental, partials, level) => {
    partials.forEach(([ratio, gain, decay]) => {
        const tone = ctx.createOscillator();
        const envelope = ctx.createGain();
        tone.type = "sine";
        tone.frequency.value = fundamental * ratio;
        envelope.gain.setValueAtTime(0.0001, at);
        envelope.gain.exponentialRampToValueAtTime(level * gain, at + 0.004);
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
        tone.connect(envelope).connect(ctx.destination);
        tone.start(at);
        tone.stop(at + decay + 0.05);
    });
};

// A short burst of filtered noise: tile set down on tile.
const thud = (ctx, at, level) => {
    const length = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let n = 0; n < length; n += 1) data[n] = (Math.random() * 2 - 1) * (1 - n / length) ** 3;
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 900;
    envelope.gain.value = level;
    noise.connect(filter).connect(envelope).connect(ctx.destination);
    noise.start(at);
};

const CERAMIC = [
    [1, 1, 0.5],
    [2.76, 0.45, 0.3],
    [5.4, 0.2, 0.16],
    [8.93, 0.08, 0.1],
];

const SOUNDS = {
    clink: (ctx, at) => strike(ctx, at, 1650, CERAMIC, 0.08),
    knock: (ctx, at) => {
        thud(ctx, at, 0.5);
        strike(
            ctx,
            at,
            190,
            [
                [1, 1, 0.18],
                [2.3, 0.3, 0.1],
            ],
            0.12,
        );
    },
    chime: (ctx, at) => [523.25, 659.25, 783.99].forEach((note, n) => strike(ctx, at + n * 0.16, note, CERAMIC, 0.06)),
};

const isSoundOn = () => typeof window !== "undefined" && readChoice(STORAGE_KEY);

// Off unless this browser turned the kit on in Profile; a browser that blocks audio simply stays quiet.
export const playSound = (name) => {
    if (!isSoundOn()) return;
    try {
        const ctx = context();
        SOUNDS[name](ctx, ctx.currentTime + 0.01);
    } catch {
        // No audio here.
    }
};

const setSoundChoice = (on) => {
    writeChoice(STORAGE_KEY, on, CHANGE_EVENT);
    if (on) playSound("chime");
};

export function useSoundChoice() {
    return [useChoiceSync(CHANGE_EVENT, isSoundOn) ?? false, setSoundChoice];
}
