import { useEffect, useRef } from "react";
import { isCalm } from "@/lib/calmMode";

// Draws a scene in its own logical units scaled to the canvas's CSS size; pointer positions arrive in scene units.
// The loop sleeps while the tab is hidden or the canvas is off screen.
export function useStoneScene(createScene) {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const createRef = useRef(createScene);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const scene = createRef.current({ calm: isCalm() });
        sceneRef.current = scene;
        const g = canvas.getContext("2d");
        let frame = 0;
        let visible = true;
        let last = performance.now();

        const fit = () => {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            const box = canvas.getBoundingClientRect();
            canvas.width = Math.max(1, Math.round(box.width * ratio));
            canvas.height = Math.max(1, Math.round(box.height * ratio));
        };
        const loop = (now) => {
            frame = requestAnimationFrame(loop);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (!visible || document.hidden) return;
            scene.step(dt);
            g.setTransform(canvas.width / scene.width, 0, 0, canvas.height / scene.height, 0, 0);
            scene.draw(g);
        };
        const toScene = (event) => {
            const box = canvas.getBoundingClientRect();
            return [((event.clientX - box.left) / box.width) * scene.width, ((event.clientY - box.top) / box.height) * scene.height];
        };
        const onPointer = (event) => scene.pointer?.(...toScene(event), event);
        const onLeave = () => scene.leave?.();

        fit();
        const resize = new ResizeObserver(fit);
        resize.observe(canvas);
        const sight = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
        });
        sight.observe(canvas);
        canvas.addEventListener("pointermove", onPointer);
        canvas.addEventListener("pointerdown", onPointer);
        canvas.addEventListener("pointerup", onPointer);
        canvas.addEventListener("pointerleave", onLeave);
        frame = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            sight.disconnect();
            canvas.removeEventListener("pointermove", onPointer);
            canvas.removeEventListener("pointerdown", onPointer);
            canvas.removeEventListener("pointerup", onPointer);
            canvas.removeEventListener("pointerleave", onLeave);
            sceneRef.current = null;
        };
    }, []);

    return { canvasRef, sceneRef };
}
