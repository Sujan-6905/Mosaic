import { useEffect, useRef, useState } from "react";
import { JoiningOverlay } from "../chrome/BoardStates";
import { KilnScene } from "./kilnScene";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./Kiln.module.css";

// A warm server joins well inside this; past it, the wait is a cold start worth explaining.
const KILN_AFTER_MS = 2500;
const READY_HOLD_MS = 1100;
const TYPICAL_WAKE_SECONDS = 60;
const LONGEST_WAKE_SECONDS = 300;

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function Kiln({ seconds, ready, canKeep, onStroke }) {
    const onStrokeRef = useRef(onStroke);
    onStrokeRef.current = onStroke;
    const { canvasRef, sceneRef } = useStoneScene((options) => new KilnScene({ ...options, onStroke: (points) => onStrokeRef.current(points) }));

    useEffect(() => {
        // Heat climbs fast at first and never quite reaches gold before the server answers.
        sceneRef.current?.setProgress(1 - Math.exp(-seconds / (TYPICAL_WAKE_SECONDS * 0.6)));
    }, [seconds, sceneRef]);

    useEffect(() => {
        if (ready) sceneRef.current?.finish();
    }, [ready, sceneRef]);

    return (
        <div className={styles.kiln} data-ready={ready} role="status" aria-live="polite">
            <header className={styles.head}>
                <div className={styles.copy}>
                    <h1 className={styles.title}>{ready ? "Ready." : "The kiln is warming."}</h1>
                    <p className={styles.lede}>
                        {ready
                            ? canKeep
                                ? "Opening your board, with what you drew already on it."
                                : "Opening the board."
                            : "Mosaic runs on free hosting that sleeps when nobody is here. Waking it usually takes under a minute, and at most a few."}
                    </p>
                </div>
                <div className={styles.timer}>
                    <span className={styles.seconds}>{ready ? "Awake" : clock(seconds)}</span>
                    <span className={styles.timerNote}>{ready ? "Thank you for waiting" : `So far, up to ${clock(LONGEST_WAKE_SECONDS)}`}</span>
                </div>
            </header>
            <canvas ref={canvasRef} className={styles.canvas} aria-label="A drawing pad below a row of tiles that heat up as the server wakes" />
            <p className={styles.foot}>
                {canKeep ? "What you draw here is waiting on the board when it opens." : "This board is view only, so the drawing stays here."}
                <span className={styles.footHint}> Move over the tiles to blow on them.</span>
            </p>
        </div>
    );
}

// Between opening a board and the room answering: joining tiles for a normal wait, the kiln for a cold start,
// then "Ready." onArrive receives any strokes drawn meanwhile.
export default function BoardArrival({ joined, canKeep, onArrive }) {
    const [phase, setPhase] = useState(joined ? "done" : "joining");
    const [seconds, setSeconds] = useState(0);
    const strokesRef = useRef([]);
    const startedAt = useRef(0);

    useEffect(() => {
        if (phase !== "joining" && phase !== "kiln") return undefined;
        if (!startedAt.current) startedAt.current = performance.now();
        const tick = setInterval(() => {
            const elapsed = performance.now() - startedAt.current;
            setSeconds(elapsed / 1000);
            if (elapsed > KILN_AFTER_MS) setPhase((current) => (current === "joining" ? "kiln" : current));
        }, 250);
        return () => clearInterval(tick);
    }, [phase]);

    useEffect(() => {
        if (!joined || phase === "done" || phase === "ready") return;
        if (strokesRef.current.length > 0) onArrive(strokesRef.current);
        strokesRef.current = [];
        setPhase(phase === "kiln" ? "ready" : "done");
    }, [joined, phase, onArrive]);

    useEffect(() => {
        if (phase !== "ready") return undefined;
        const leave = setTimeout(() => setPhase("done"), READY_HOLD_MS);
        return () => clearTimeout(leave);
    }, [phase]);

    if (phase === "done") return null;
    if (phase === "joining") return <JoiningOverlay />;
    return (
        <Kiln
            seconds={seconds}
            ready={phase === "ready"}
            canKeep={canKeep}
            onStroke={(points) => {
                strokesRef.current.push(points);
            }}
        />
    );
}
