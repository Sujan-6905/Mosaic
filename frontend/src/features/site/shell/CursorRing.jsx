import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./CursorRing.module.css";

// Fine pointers only, since touch has nothing to trail. Rendered into <body>: the system cursor is hidden
// document-wide, so the ring has to sit above the auth modal too.

const INTERACTIVE = "a, button, [data-cursor], input, textarea, select";

export default function CursorRing() {
    const ring = useRef(null);
    const dot = useRef(null);
    const label = useRef(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (window.matchMedia("(pointer: fine)").matches) setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return undefined;

        const root = document.documentElement;
        root.classList.add(styles.armed);

        const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const eased = { ...target };
        let frame = 0;
        let last = performance.now();
        let visible = false;

        // Refs detach in the mutation phase but this cleanup runs later, so a queued frame or pointer event can arrive
        // after the nodes are gone; every handler bails on a detached ring.
        const attached = () => ring.current && dot.current && label.current;

        const tick = (now) => {
            frame = requestAnimationFrame(tick);
            if (!attached()) return;
            const delta = Math.min((now - last) / 1000, 0.1);
            last = now;
            const rate = 1 - Math.exp(-14 * delta);
            eased.x += (target.x - eased.x) * rate;
            eased.y += (target.y - eased.y) * rate;
            ring.current.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0) translate(-50%, -50%)`;
            dot.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%)`;
        };
        frame = requestAnimationFrame(tick);

        const onMove = (event) => {
            target.x = event.clientX;
            target.y = event.clientY;
            if (visible || !attached()) return;
            visible = true;
            ring.current.dataset.visible = "true";
            dot.current.dataset.visible = "true";
        };

        const onOver = (event) => {
            if (!attached()) return;
            const hit = event.target.closest?.(INTERACTIVE);
            ring.current.dataset.active = hit ? "true" : "false";
            const word = hit?.getAttribute("data-cursor") || "";
            label.current.textContent = word;
            ring.current.dataset.labelled = word ? "true" : "false";
        };

        const onLeave = () => {
            visible = false;
            if (!attached()) return;
            ring.current.dataset.visible = "false";
            dot.current.dataset.visible = "false";
        };

        const setPressed = (value) => () => {
            if (attached()) ring.current.dataset.pressed = value;
        };
        const onDown = setPressed("true");
        const onUp = setPressed("false");

        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerover", onOver, { passive: true });
        window.addEventListener("pointerdown", onDown, { passive: true });
        window.addEventListener("pointerup", onUp, { passive: true });
        document.addEventListener("pointerleave", onLeave);

        return () => {
            cancelAnimationFrame(frame);
            root.classList.remove(styles.armed);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerover", onOver);
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointerleave", onLeave);
        };
    }, [mounted]);

    if (!mounted) return null;

    return createPortal(
        <>
            <span ref={ring} className={styles.ring} aria-hidden="true">
                <span ref={label} className={styles.label} />
            </span>
            <span ref={dot} className={styles.dot} aria-hidden="true" />
        </>,
        document.body,
    );
}
