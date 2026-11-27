import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import axiosInstance from "@/lib/axiosInstance";
import useAppSession from "@/hooks/useAppSession";
import { isCalm } from "@/lib/calmMode";
import { drawSceneStatic } from "@/features/board/rendering/staticSceneRenderer";
import { panByScreenDelta, worldToScreen, zoomAtScreenPoint } from "@/features/board/camera/camera";
import { cameraToFit } from "@/features/board/camera/viewport";
import { FIGURE, diagramElements, diagramPackets, onSiteSurface } from "./liveDiagrams";
import styles from "./LiveDiagram.module.css";

const PACKET_SECONDS = 2.4;
const PACKET_COLORS = { gold: "#ffb43c", faint: "#868a92", stopped: "#de5816" };
const FIGURE_BOUNDS = { minX: 0, minY: 0, maxX: FIGURE.width, maxY: FIGURE.height };
const ZOOM_LIMITS = { min: 0.25, max: 3 };

const drawPackets = (g, packets, camera, time) => {
    for (const packet of packets) {
        const phase = (time - packet.delay) / PACKET_SECONDS;
        if (phase < 0) continue;
        const along = phase % 1;
        const reach = packet.variant === "stopped" ? Math.min(along * 1.6, 1) : along;
        const at = worldToScreen(camera, packet.x + packet.dx * reach, packet.y + packet.dy * reach);
        g.globalAlpha = Math.sin(along * Math.PI);
        g.fillStyle = PACKET_COLORS[packet.variant] ?? PACKET_COLORS.gold;
        g.beginPath();
        g.arc(at.x, at.y, 6 * Math.min(1.4, camera.zoom + 0.4), 0, Math.PI * 2);
        g.fill();
    }
    g.globalAlpha = 1;
};

// The board's own renderer draws the diagram; drag pans, pinch or ctrl-scroll zooms, and it opens as a real board.
export default function LiveDiagram({ id, title, onSignIn }) {
    const router = useRouter();
    const { session, isAuthenticated } = useAppSession();
    const canvasRef = useRef(null);
    const cameraRef = useRef(null);
    const sizeRef = useRef({ width: 0, height: 0 });
    const [opening, setOpening] = useState(false);
    const [failed, setFailed] = useState(false);
    const elements = useMemo(() => diagramElements(id), [id]);
    const drawn = useMemo(() => onSiteSurface(elements), [elements]);
    const packets = useMemo(() => diagramPackets(id), [id]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const g = canvas.getContext("2d");
        let frame = 0;
        let visible = true;
        const start = performance.now();

        const fit = () => {
            const box = canvas.getBoundingClientRect();
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round(box.width * ratio));
            canvas.height = Math.max(1, Math.round(box.height * ratio));
            sizeRef.current = { width: box.width, height: box.height, ratio };
            cameraRef.current = cameraToFit(FIGURE_BOUNDS, box.width, box.height, 16, { clamp: false });
        };
        const draw = (now) => {
            const { width, height, ratio } = sizeRef.current;
            const camera = cameraRef.current;
            if (!camera) return;
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, canvas.width, canvas.height);
            // The renderer sets its own transform from the camera, so the pixel ratio rides on the zoom.
            drawSceneStatic(g, drawn, null, { ...camera, zoom: camera.zoom * ratio }, width * ratio, height * ratio);
            g.setTransform(ratio, 0, 0, ratio, 0, 0);
            if (!isCalm()) drawPackets(g, packets, camera, (now - start) / 1000);
        };
        const loop = (now) => {
            frame = requestAnimationFrame(loop);
            if (visible && !document.hidden) draw(now);
        };

        fit();
        const resize = new ResizeObserver(fit);
        resize.observe(canvas);
        const sight = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
        });
        sight.observe(canvas);
        frame = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            sight.disconnect();
        };
    }, [drawn, packets]);

    // A plain scroll keeps scrolling the page; only a pinch (ctrl-wheel) zooms the diagram.
    useEffect(() => {
        const canvas = canvasRef.current;
        const onWheel = (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const box = canvas.getBoundingClientRect();
            const camera = cameraRef.current;
            const zoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, camera.zoom * Math.exp(-event.deltaY * 0.01)));
            cameraRef.current = zoomAtScreenPoint(camera, event.clientX - box.left, event.clientY - box.top, zoom);
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, []);

    const pan = (event) => {
        if (!event.buttons) return;
        cameraRef.current = panByScreenDelta(cameraRef.current, event.movementX, event.movementY);
    };
    const reset = () => {
        const { width, height } = sizeRef.current;
        cameraRef.current = cameraToFit(FIGURE_BOUNDS, width, height, 16, { clamp: false });
    };

    const openAsBoard = async () => {
        if (!isAuthenticated) {
            onSignIn?.();
            return;
        }
        setOpening(true);
        setFailed(false);
        try {
            const { data } = await axiosInstance.post(
                "/api/drawing/import",
                { title: `How it works: ${title}`, scene: { mosaicSceneVersion: 1, elements } },
                { headers: { Authorization: `Bearer ${session?.accessToken}` } },
            );
            router.push(`/?shareId=${data.data.shareId}`);
        } catch {
            setOpening(false);
            setFailed(true);
        }
    };

    return (
        <div className={styles.live}>
            <canvas
                ref={canvasRef}
                className={styles.canvas}
                role="img"
                aria-label={`${title}, drawn as a Mosaic board`}
                onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                onPointerMove={pan}
                onDoubleClick={reset}
            />
            <div className={styles.bar}>
                <span className={styles.hint} role={failed ? "alert" : undefined}>
                    {failed ? "Couldn't open it just now. Try again in a moment." : "A live board. Drag to look around, pinch to zoom."}
                </span>
                <button type="button" className={styles.open} onClick={openAsBoard} disabled={opening}>
                    {opening ? "Opening" : isAuthenticated ? "Open as a board" : "Sign in to open as a board"}
                </button>
            </div>
        </div>
    );
}
