import { useState } from "react";
import { TwoRoomsScene } from "./twoRoomsScene";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./TwoRooms.module.css";

// A playable model of the conflict rule: drag the note on either screen and set each side's lag.
export default function TwoRooms() {
    const [verdict, setVerdict] = useState({ text: "Drag the note on either screen, both at once if you can.", settled: false });
    const { canvasRef, sceneRef } = useStoneScene((options) => new TwoRoomsScene({ ...options, onVerdict: (text, settled) => setVerdict({ text, settled }) }));

    return (
        <div className={styles.rooms}>
            <div className={styles.stage} role="group" aria-label="The simulation; scroll sideways on a narrow screen" tabIndex={0}>
                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    aria-label="Two screens share one sticky note through a server. Drag the note on either screen and set each side's lag; the move that reaches the server last wins on both."
                />
            </div>
            <p className={styles.verdict} data-settled={verdict.settled} role="status">
                <span aria-hidden="true" />
                {verdict.text}
            </p>
            <div className={styles.controls}>
                <button type="button" className={styles.race} onClick={() => sceneRef.current?.race()}>
                    Race them now
                </button>
                <button type="button" className={styles.restart} onClick={() => sceneRef.current?.restart()}>
                    Start over
                </button>
                <span className={styles.controlsHint}>Drag either lag slider first to change who wins.</span>
            </div>
            <p className={styles.footnote}>Nothing is lost either way: the losing move is still in the operation log, and replay shows both.</p>
        </div>
    );
}
