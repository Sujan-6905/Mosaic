import { useEffect, useRef } from "react";
import { GuardianScene } from "./guardianScene";
import { ThresholdScene } from "./thresholdScene";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./AuthStones.module.css";

const GUARDIAN_VOICE = [
    { inscription: "Nothing laid yet", line: "The outline is only chalk. Type, and the stones go down." },
    { inscription: "Loose stones", line: "Anyone could step over this." },
    { inscription: "The dog is down", line: "And dozing. A longer one would wake it." },
    { inscription: "On the chain", line: "Awake and collared. One more step gilds the door." },
    { inscription: "Cave canem", line: "Beware of the dog. This door is guarded." },
];

// Reads only the strength score and the length, never the characters.
export function GuardianArt({ score, length }) {
    const { canvasRef, sceneRef } = useStoneScene((options) => new GuardianScene(options));
    const voice = GUARDIAN_VOICE[score];

    useEffect(() => {
        sceneRef.current?.aim(score, length);
    }, [score, length, sceneRef]);

    return (
        <div className={styles.art} aria-hidden="true">
            <span className={styles.wordmark}>Mosaic</span>
            <canvas ref={canvasRef} className={styles.guardian} />
            <div className={styles.voice}>
                <span className={styles.inscription} data-gilded={score === 4}>
                    {voice.inscription}
                </span>
                <p className={styles.line}>{voice.line}</p>
            </div>
            <p className={styles.credit}>After the guard dog set in mosaic at the door of the House of the Tragic Poet, Pompeii.</p>
        </div>
    );
}

const THRESHOLD_LINES = {
    idle: "Sign in and pick up wherever the board was left.",
    failed: "Some stones came loose. Try again and they go back.",
    welcomed: "Have: be well. The word set in the pavement outside the House of the Faun, Pompeii.",
};

// `failures` counts refusals so a repeated message still shakes the wall, `trying` gathers loose stones,
// and `welcomedAs` spells HAVE, calling onOpened once the wall has parted.
export function ThresholdArt({ failures, trying, welcomedAs, onOpened }) {
    const { canvasRef, sceneRef } = useStoneScene((options) => new ThresholdScene(options));
    const openedRef = useRef(onOpened);
    openedRef.current = onOpened;

    useEffect(() => {
        if (failures > 0) sceneRef.current?.fail();
    }, [failures, sceneRef]);

    useEffect(() => {
        if (trying) sceneRef.current?.mend();
    }, [trying, sceneRef]);

    useEffect(() => {
        if (welcomedAs === null || welcomedAs === undefined) return;
        sceneRef.current?.succeed(welcomedAs, () => openedRef.current?.());
    }, [welcomedAs, sceneRef]);

    const mood = welcomedAs != null ? "welcomed" : failures > 0 && !trying ? "failed" : "idle";

    return (
        <div className={styles.art} aria-hidden="true">
            <span className={styles.wordmark}>Mosaic</span>
            <canvas ref={canvasRef} className={styles.threshold} />
            <div className={styles.voice}>
                <span className={styles.inscription} data-gilded={mood === "welcomed"}>
                    {mood === "welcomed" ? "Have" : mood === "failed" ? "Shaken loose" : "The door"}
                </span>
                <p className={styles.line}>{THRESHOLD_LINES[mood]}</p>
            </div>
            <p className={styles.credit}>Move the pointer over the stones.</p>
        </div>
    );
}
