import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMap, faXmark } from "@fortawesome/free-solid-svg-icons";
import Panel from "@/components/ui/Panel";
import IconButton from "@/components/ui/IconButton";
import styles from "./Minimap.module.css";
import { computeMinimapProjection, projectWorldToMinimap, projectMinimapToWorld } from "./minimap";
import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { resolveElementColor } from "../rendering/colorResolver";

const MINIMAP_WIDTH = 170;
const MINIMAP_HEIGHT = 128;

// An overview of the board and the current view; click or drag to move there.
const Minimap = ({ isOpen, onToggle, contentBounds, viewportWorldBounds, elements, onRecenter }) => {
    const panelRef = useRef(null);
    const canvasRef = useRef(null);
    const isDragging = useRef(false);
    // The colour cache has no change event, so a theme change repaints the miniature once.
    const [themeTick, setThemeTick] = useState(0);

    useEffect(() => {
        const bump = () => setThemeTick((t) => t + 1);
        window.addEventListener("mosaic:theme-changed", bump);
        return () => window.removeEventListener("mosaic:theme-changed", bump);
    }, []);

    const recenterFromEvent = useCallback(
        (e) => {
            if (!panelRef.current || !contentBounds) return;
            const projection = computeMinimapProjection(contentBounds, MINIMAP_WIDTH, MINIMAP_HEIGHT);
            if (!projection) return;
            const rect = panelRef.current.getBoundingClientRect();
            const world = projectMinimapToWorld(projection, e.clientX - rect.left, e.clientY - rect.top);
            onRecenter(world.x, world.y);
        },
        [contentBounds, onRecenter],
    );

    // A press jumps there, and holding and dragging keeps following, like a map's overview.
    const handlePointerDown = (e) => {
        isDragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        recenterFromEvent(e);
    };
    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        recenterFromEvent(e);
    };
    const handlePointerUp = (e) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Each element as a flat rectangle in its own colour on one canvas, since a board can hold thousands.
    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas || !contentBounds) return;
        const projection = computeMinimapProjection(contentBounds, MINIMAP_WIDTH, MINIMAP_HEIGHT);
        if (!projection) return;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        canvas.width = MINIMAP_WIDTH * dpr;
        canvas.height = MINIMAP_HEIGHT * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
        for (const element of Object.values(elements || {})) {
            const bounds = getElementBounds(element);
            if (!bounds) continue;
            const topLeft = projectWorldToMinimap(projection, bounds.minX, bounds.minY);
            const width = Math.max(1, (bounds.maxX - bounds.minX) * projection.scale);
            const height = Math.max(1, (bounds.maxY - bounds.minY) * projection.scale);
            ctx.globalAlpha = element.opacity ?? 1;
            ctx.fillStyle = resolveElementColor(element.colorToken, element.color) || "#888888";
            ctx.fillRect(topLeft.x, topLeft.y, width, height);
        }
        ctx.globalAlpha = 1;
    }, [isOpen, elements, contentBounds, themeTick]);

    if (!isOpen) return null;

    const projection = contentBounds ? computeMinimapProjection(contentBounds, MINIMAP_WIDTH, MINIMAP_HEIGHT) : null;

    return (
        <Panel elevation="lg" padded={false} className={styles.minimapPanel} data-board-chrome>
            <div className={styles.header}>
                <div className={styles.headerLabel}>
                    <FontAwesomeIcon icon={faMap} />
                    <span>Minimap</span>
                </div>
                <IconButton size="sm" aria-label="Hide minimap" title="Hide minimap" onClick={onToggle}>
                    <FontAwesomeIcon icon={faXmark} />
                </IconButton>
            </div>
            <div
                ref={panelRef}
                className={styles.minimap}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="Click or drag to jump there"
            >
                <canvas ref={canvasRef} className={styles.minimapCanvas} width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} />
                {projection && viewportWorldBounds && (
                    <div
                        className={styles.viewportRect}
                        style={{
                            left: projectWorldToMinimap(projection, viewportWorldBounds.minX, viewportWorldBounds.minY).x,
                            top: projectWorldToMinimap(projection, viewportWorldBounds.minX, viewportWorldBounds.minY).y,
                            width: (viewportWorldBounds.maxX - viewportWorldBounds.minX) * projection.scale,
                            height: (viewportWorldBounds.maxY - viewportWorldBounds.minY) * projection.scale,
                        }}
                    />
                )}
            </div>
        </Panel>
    );
};

export default Minimap;
