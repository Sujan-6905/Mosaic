import { useEffect, useState } from "react";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import { LETTER_SECONDS, createLetterScene } from "./letterScene";
import styles from "./LetterPlayer.module.css";

const cssFont = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// The letter's scene with its own controls: play, pause, and a scrubber anyone can drag.
export default function LetterPlayer({ letter, frames }) {
    const { canvasRef, sceneRef } = useStoneScene(({ calm }) =>
        createLetterScene({
            company: letter.company,
            note: letter.note,
            frames,
            latestSeq: letter.reel.latestSeq,
            calm,
            font: { display: cssFont("--font-display", "serif"), body: cssFont("--font-sans", "sans-serif"), mono: cssFont("--font-mono", "monospace") },
        }),
    );
    const [clock, setClock] = useState({ time: 0, playing: true });

    useEffect(() => {
        let frame = 0;
        const read = () => {
            frame = requestAnimationFrame(read);
            const scene = sceneRef.current;
            if (scene)
                setClock((current) =>
                    current.time === scene.time && current.playing === scene.playing ? current : { time: scene.time, playing: scene.playing },
                );
        };
        frame = requestAnimationFrame(read);
        return () => cancelAnimationFrame(frame);
    }, [sceneRef]);

    const done = clock.time >= LETTER_SECONDS;
    return (
        <figure className={styles.player}>
            <canvas
                ref={canvasRef}
                className={styles.canvas}
                role="img"
                aria-label={`A letter to ${letter.company}: Hello, then ${letter.title} drawing itself from its history.`}
            />
            <figcaption className={styles.controls}>
                <button type="button" className={styles.play} onClick={() => (clock.playing ? sceneRef.current?.pause() : sceneRef.current?.play())}>
                    {clock.playing ? "Pause" : done ? "Play again" : "Play"}
                </button>
                <input
                    type="range"
                    className={styles.scrub}
                    min={0}
                    max={LETTER_SECONDS}
                    step={0.05}
                    value={clock.time}
                    onChange={(event) => sceneRef.current?.seek(Number(event.target.value))}
                    aria-label="Scrub through the letter"
                />
            </figcaption>
        </figure>
    );
}
