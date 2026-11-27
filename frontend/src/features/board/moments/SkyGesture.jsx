import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { isCalm } from "@/lib/calmMode";
import { recogniseSky } from "./skyGesture";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./SkyGesture.module.css";

const TILE = 44;
const FLIP_SECONDS = 0.34;
const SPREAD_SECONDS = 0.55;
const isTyping = (target) => target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

// The old theme laid as tiles over the page as the theme changes underneath, turned over outward from where
// the sky was drawn, each showing a gold edge as it passes edge-on.
class WaveScene {
    constructor({ origin, ground, onCovered, onDone }) {
        this.width = Math.max(1, window.innerWidth);
        this.height = Math.max(1, window.innerHeight);
        this.origin = origin;
        this.ground = ground;
        this.onCovered = onCovered;
        this.onDone = onDone;
        this.time = 0;
        this.reach = Math.max(
            ...[
                [0, 0],
                [this.width, 0],
                [0, this.height],
                [this.width, this.height],
            ].map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)),
        );
    }

    step(dt) {
        this.time += dt;
        if (this.time > SPREAD_SECONDS + FLIP_SECONDS + 0.05 && this.onDone) {
            const done = this.onDone;
            this.onDone = null;
            done();
        }
    }

    draw(g) {
        g.clearRect(0, 0, this.width, this.height);
        for (let y = 0; y < this.height; y += TILE) {
            for (let x = 0; x < this.width; x += TILE) {
                const cx = x + TILE / 2;
                const cy = y + TILE / 2;
                const start = (Math.hypot(cx - this.origin.x, cy - this.origin.y) / this.reach) * SPREAD_SECONDS;
                const p = (this.time - start) / FLIP_SECONDS;
                if (p >= 1) continue;
                const turn = Math.max(0, Math.cos(Math.max(0, p) * Math.PI * 0.5));
                const h = (TILE + 1) * turn;
                g.fillStyle = this.ground;
                g.fillRect(x, cy - h / 2, TILE + 1, h);
                if (p > 0) {
                    g.fillStyle = `rgba(255,180,60,${Math.sin(p * Math.PI) * 0.85})`;
                    g.fillRect(x + 1, cy - h / 2 - 1, TILE - 2, 2);
                    g.fillRect(x + 1, cy + h / 2 - 1, TILE - 2, 2);
                }
            }
        }
        // The theme changes underneath only once the old one is laid over the page.
        if (this.onCovered) {
            const covered = this.onCovered;
            this.onCovered = null;
            covered();
        }
    }
}

function Wave({ origin, ground, onCovered, onDone }) {
    const { canvasRef } = useStoneScene(() => new WaveScene({ origin, ground, onCovered, onDone }));
    return <canvas ref={canvasRef} className={styles.wave} aria-hidden="true" />;
}

// Hold G and draw: a sun turns the board light, a crescent turns it dark.
export default function SkyGesture() {
    const { theme, setTheme } = useTheme();
    const [held, setHeld] = useState(false);
    const [note, setNote] = useState(null);
    const [wave, setWave] = useState(null);
    const inkRef = useRef(null);
    const strokeRef = useRef(null);
    const drawingRef = useRef(false);
    const keyHeldRef = useRef(false);

    useEffect(() => {
        const down = (event) => {
            if (event.key.toLowerCase() !== "g" || event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
            keyHeldRef.current = true;
            setNote(null);
            setHeld(true);
        };
        const up = (event) => {
            if (event.key.toLowerCase() !== "g") return;
            keyHeldRef.current = false;
            if (!drawingRef.current) setHeld(false);
        };
        const release = () => {
            keyHeldRef.current = false;
            setHeld(false);
        };
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        window.addEventListener("blur", release);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("blur", release);
        };
    }, []);

    useEffect(() => {
        if (!note) return undefined;
        const fade = setTimeout(() => setNote(null), 2600);
        return () => clearTimeout(fade);
    }, [note]);

    const ink = () => {
        const canvas = inkRef.current;
        const g = canvas.getContext("2d");
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(window.innerWidth * ratio)) {
            canvas.width = Math.round(window.innerWidth * ratio);
            canvas.height = Math.round(window.innerHeight * ratio);
        }
        g.setTransform(ratio, 0, 0, ratio, 0, 0);
        g.clearRect(0, 0, window.innerWidth, window.innerHeight);
        const points = strokeRef.current ?? [];
        g.lineCap = "round";
        g.lineJoin = "round";
        g.shadowColor = "rgba(255,180,60,.7)";
        g.shadowBlur = 14;
        g.strokeStyle = "#ffb43c";
        g.lineWidth = 5;
        g.beginPath();
        points.forEach((p, n) => (n ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
    };

    const finish = () => {
        drawingRef.current = false;
        const points = strokeRef.current ?? [];
        strokeRef.current = null;
        ink();
        const sky = recogniseSky(points);
        if (!sky) {
            setNote("Draw a round sun for light, or a crescent for dark.");
            if (!keyHeldRef.current) setHeld(false);
            return;
        }
        const next = sky === "sun" ? "light" : "dark";
        setHeld(false);
        if (next === theme) {
            setNote(sky === "sun" ? "The sun is already up." : "It is already night.");
            return;
        }
        const ground = getComputedStyle(document.documentElement).getPropertyValue("--color-bg-canvas").trim() || "#15171b";
        const origin = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
        if (isCalm()) setTheme(next);
        else setWave({ origin, ground, next, key: Date.now() });
    };

    return (
        <>
            {held && (
                <div className={styles.sky} data-board-chrome>
                    <canvas
                        ref={inkRef}
                        className={styles.ink}
                        aria-label="Draw a sun for the light theme or a crescent moon for the dark theme"
                        onPointerDown={(event) => {
                            drawingRef.current = true;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            strokeRef.current = [{ x: event.clientX, y: event.clientY }];
                            ink();
                        }}
                        onPointerMove={(event) => {
                            if (!drawingRef.current) return;
                            strokeRef.current.push({ x: event.clientX, y: event.clientY });
                            ink();
                        }}
                        onPointerUp={finish}
                    />
                    <p className={styles.hint}>
                        Draw a <strong>sun</strong> for light, or a <strong>crescent</strong> for dark.
                    </p>
                </div>
            )}
            {note && (
                <p className={styles.note} role="status">
                    {note}
                </p>
            )}
            {wave && <Wave key={wave.key} origin={wave.origin} ground={wave.ground} onCovered={() => setTheme(wave.next)} onDone={() => setWave(null)} />}
        </>
    );
}
