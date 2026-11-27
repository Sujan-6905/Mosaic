import { useEffect, useRef, useState } from "react";
import { isCalm } from "@/lib/calmMode";
import { Debris } from "@/components/stoneScene/stones";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./Mend.module.css";
import { playSound } from "@/lib/soundKit";

const MEND_SECONDS = 1.25;
const STEP = 14;

// A molten seam crosses the board as the connection returns: colour comes back behind it and the join cools
// from white heat to gold, like a kintsugi repair.
class SeamScene {
    constructor({ onFront, onDone }) {
        this.width = Math.max(1, window.innerWidth);
        this.height = Math.max(1, window.innerHeight);
        this.onFront = onFront;
        this.onDone = onDone;
        this.time = 0;
        this.debris = new Debris();
        this.crack = Array.from({ length: Math.ceil(this.height / STEP) + 1 }, (_unused, n) => ({ y: n * STEP, dx: (Math.random() - 0.5) * 34 }));
        for (let n = 1; n < this.crack.length; n += 1) this.crack[n].dx = this.crack[n - 1].dx * 0.55 + this.crack[n].dx * 0.45;
    }

    frontX() {
        const t = Math.min(1, this.time / MEND_SECONDS);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        return -60 + eased * (this.width + 120);
    }

    step(dt) {
        this.time += dt;
        const x = this.frontX();
        this.onFront(Math.max(0, x));
        if (this.time < MEND_SECONDS && Math.random() < 0.9) {
            const at = this.crack[Math.floor(Math.random() * this.crack.length)];
            this.debris.spark(x + at.dx, at.y, 2, 0, 180);
        }
        this.debris.step(dt);
        if (this.time > MEND_SECONDS + 0.9 && this.onDone) {
            const done = this.onDone;
            this.onDone = null;
            done();
        }
    }

    path(g, x) {
        g.beginPath();
        this.crack.forEach((point, n) => (n ? g.lineTo(x + point.dx, point.y) : g.moveTo(x + point.dx, point.y)));
    }

    draw(g) {
        g.clearRect(0, 0, this.width, this.height);
        g.lineJoin = "round";
        g.lineCap = "round";
        if (this.time < MEND_SECONDS + 0.1) {
            const x = this.frontX();
            // The warmth the seam leaves behind it as colour comes back.
            const wash = g.createLinearGradient(x - 220, 0, x, 0);
            wash.addColorStop(0, "rgba(255,180,60,0)");
            wash.addColorStop(1, "rgba(255,180,60,0.14)");
            g.fillStyle = wash;
            g.fillRect(x - 220, 0, 220, this.height);
            g.globalCompositeOperation = "lighter";
            g.strokeStyle = "rgba(255,150,40,.28)";
            g.lineWidth = 26;
            this.path(g, x);
            g.stroke();
            g.strokeStyle = "rgba(255,190,80,.8)";
            g.lineWidth = 6;
            this.path(g, x);
            g.stroke();
            g.strokeStyle = "#fff4d6";
            g.lineWidth = 2;
            this.path(g, x);
            g.stroke();
            g.globalCompositeOperation = "source-over";
        }
        this.debris.draw(g);
    }
}

function Seam({ onFront, onDone }) {
    const { canvasRef } = useStoneScene(() => new SeamScene({ onFront, onDone }));
    return <canvas ref={canvasRef} className={styles.seam} aria-hidden="true" />;
}

// A merge joins two sheets of the same board; the join crosses it in gold.
export function MergeSeam({ onDone }) {
    return <Seam onFront={() => {}} onDone={onDone} />;
}

// The board while the connection is down, and the repair once it is back.
export default function Mend({ offline }) {
    const [phase, setPhase] = useState(offline ? "drained" : "clear");
    const drainRef = useRef(null);

    useEffect(() => {
        if (offline) setPhase("drained");
        else
            setPhase((current) => {
                if (current !== "drained") return current;
                playSound("clink");
                return isCalm() ? "clear" : "mending";
            });
    }, [offline]);

    if (phase === "clear") return null;
    return (
        <>
            <div ref={drainRef} className={styles.drained} data-phase={phase} aria-hidden="true" />
            {phase === "mending" && <Seam onFront={(x) => drainRef.current?.style.setProperty("--mended", `${x}px`)} onDone={() => setPhase("clear")} />}
        </>
    );
}
