import { useState } from "react";
import { isEmbedFriendly, isSafeEmbedUrl } from "../../../../../shared/canvas/elements/links.js";
import { viewportWorldBounds, worldToScreen } from "../camera/camera";
import { getCachedElementBounds } from "../rendering/boundsCache";
import styles from "./EmbedLayer.module.css";

const MIN_LIVE_ZOOM = 0.2;
const VETTED_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation";
const UNVETTED_SANDBOX = "allow-scripts allow-popups allow-forms";

const isOnScreen = (screen, width, height, viewportWidth, viewportHeight) =>
    screen.x + width > 0 && screen.y + height > 0 && screen.x < viewportWidth && screen.y < viewportHeight;

// The live pages behind embed elements. Each frame ignores the pointer until
// it's activated, so panning and selecting pass straight through to the board.
const EmbedLayer = ({ elements, spatialIndex, camera, viewportWidth, viewportHeight, activeEmbedId, selectedIds, onActivate, onDeactivate }) => {
    // Pages from hosts nobody has vetted wait for this viewer's own click, so a
    // collaborator can't make everyone's browser load an arbitrary page.
    const [loadedIds, setLoadedIds] = useState(() => new Set());
    if (camera.zoom < MIN_LIVE_ZOOM) return null;
    // From what's in view, so a large board doesn't pay for a scan on every change.
    const embeds = spatialIndex
        .queryRect(viewportWorldBounds(camera, viewportWidth, viewportHeight))
        .filter((id) => elements[id]?.type === "embed")
        .map((id) => [id, elements[id]]);
    return (
        <div className={styles.layer}>
            {embeds.map(([id, element]) => {
                const bounds = getCachedElementBounds(element);
                if (!bounds || !isSafeEmbedUrl(element.url, [window.location.origin])) return null;
                const vetted = isEmbedFriendly(element.url);
                const loaded = vetted || loadedIds.has(id);
                const screen = worldToScreen(camera, bounds.minX, bounds.minY);
                const worldWidth = bounds.maxX - bounds.minX;
                const worldHeight = bounds.maxY - bounds.minY;
                if (!isOnScreen(screen, worldWidth * camera.zoom, worldHeight * camera.zoom, viewportWidth, viewportHeight)) return null;
                const active = activeEmbedId === id;
                const selected = selectedIds.includes(id);
                return (
                    <div
                        key={id}
                        className={styles.embed}
                        data-active={active || undefined}
                        style={{
                            width: worldWidth,
                            height: worldHeight,
                            transform: `translate(${screen.x}px, ${screen.y}px) scale(${camera.zoom}) rotate(${element.rotation || 0}deg)`,
                        }}
                    >
                        {loaded ? (
                            <iframe
                                className={styles.frame}
                                src={element.url}
                                title={element.title || element.url}
                                sandbox={vetted ? VETTED_SANDBOX : UNVETTED_SANDBOX}
                                allow="fullscreen; picture-in-picture; encrypted-media"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                            />
                        ) : (
                            <div className={styles.loadPage}>
                                <strong>{element.title || "A web page"}</strong>
                                <span>{element.url}</span>
                                <button
                                    type="button"
                                    data-board-chrome
                                    className={styles.loadButton}
                                    onClick={() => setLoadedIds((prev) => new Set(prev).add(id))}
                                >
                                    Load page
                                </button>
                            </div>
                        )}
                        {loaded && selected && !active && (
                            <button type="button" data-board-chrome className={styles.interact} onClick={() => onActivate(id)}>
                                Click to interact
                            </button>
                        )}
                        {active && (
                            <button type="button" data-board-chrome className={styles.done} onClick={onDeactivate}>
                                Done
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default EmbedLayer;
