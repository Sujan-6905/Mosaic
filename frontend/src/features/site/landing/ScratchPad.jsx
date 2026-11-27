import { useCallback, useEffect, useRef } from "react";
import styles from "./ScratchPad.module.css";

// The cheapest real whiteboard: strokes follow the pointer, taper with speed and fade so the section resets.
// A 2D canvas with no history or sync, since its only job is to get someone to try the gesture.

const STROKE_LIFETIME = 9000;
const MAX_STROKES = 14;

export default function ScratchPad({ onStroke, className }) {
    const canvas = useRef(null);
    const strokes = useRef([]);
    const active = useRef(null);
    const report = useRef(onStroke);
    report.current = onStroke;

    const resize = useCallback(() => {
        const element = canvas.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        element.width = Math.round(rect.width * ratio);
        element.height = Math.round(rect.height * ratio);
        const context = element.getContext("2d");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }, []);

    useEffect(() => {
        const element = canvas.current;
        const context = element.getContext("2d");
        resize();

        let frame = 0;
        let running = false;

        const paint = () => {
            const now = performance.now();
            const rect = element.getBoundingClientRect();
            context.clearRect(0, 0, rect.width, rect.height);

            strokes.current = strokes.current.filter((stroke) => stroke.live || now - stroke.finishedAt < STROKE_LIFETIME);

            for (const stroke of strokes.current) {
                const age = stroke.live ? 0 : (now - stroke.finishedAt) / STROKE_LIFETIME;
                const fade = 1 - age * age;
                context.lineCap = "round";
                context.lineJoin = "round";
                for (let index = 1; index < stroke.points.length; index += 1) {
                    const from = stroke.points[index - 1];
                    const to = stroke.points[index];
                    context.beginPath();
                    context.strokeStyle = `rgba(255, 180, 60, ${(0.34 + to.weight * 0.55) * fade})`;
                    context.lineWidth = to.weight * 8 + 1.8;
                    context.moveTo(from.x, from.y);
                    context.lineTo(to.x, to.y);
                    context.stroke();
                }
            }

            if (!strokes.current.length && !active.current) {
                running = false;
                return;
            }
            frame = requestAnimationFrame(paint);
        };

        const wake = () => {
            if (running) return;
            running = true;
            frame = requestAnimationFrame(paint);
        };

        const pointFrom = (event) => {
            const rect = element.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        };

        const onDown = (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            element.setPointerCapture?.(event.pointerId);
            const point = pointFrom(event);
            active.current = { points: [{ ...point, weight: 0.5 }], live: true };
            strokes.current.push(active.current);
            if (strokes.current.length > MAX_STROKES) strokes.current.shift();
            wake();
        };

        const onMove = (event) => {
            const stroke = active.current;
            if (!stroke) return;
            const point = pointFrom(event);
            const previous = stroke.points[stroke.points.length - 1];
            const travelled = Math.hypot(point.x - previous.x, point.y - previous.y);
            if (travelled < 1.6) return;
            // Fast movement thins the line, the way a real pressure-sensitive
            // stroke does in the product itself.
            const weight = Math.max(0.12, 0.85 - travelled / 26);
            stroke.points.push({ ...point, weight: previous.weight * 0.6 + weight * 0.4 });
            wake();
        };

        const onUp = () => {
            const stroke = active.current;
            if (!stroke) return;
            stroke.live = false;
            stroke.finishedAt = performance.now();
            active.current = null;
            if (stroke.points.length > 2) report.current?.();
        };

        element.addEventListener("pointerdown", onDown);
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerup", onUp);
        element.addEventListener("pointercancel", onUp);
        element.addEventListener("pointerleave", onUp);
        window.addEventListener("resize", resize);

        return () => {
            cancelAnimationFrame(frame);
            element.removeEventListener("pointerdown", onDown);
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerup", onUp);
            element.removeEventListener("pointercancel", onUp);
            element.removeEventListener("pointerleave", onUp);
            window.removeEventListener("resize", resize);
        };
    }, [resize]);

    return <canvas ref={canvas} className={`${styles.pad} ${className || ""}`} aria-hidden="true" />;
}
