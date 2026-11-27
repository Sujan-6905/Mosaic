import styles from "./SelectionOverlay.module.css";
import { worldToScreen } from "../camera/camera";
import { shouldHideHandles } from "../rendering/lod";

const HANDLES = [
    { id: "nw", left: (b) => b.minX, top: (b) => b.minY, angle: 135 },
    { id: "n", left: (b) => (b.minX + b.maxX) / 2, top: (b) => b.minY, angle: 90 },
    { id: "ne", left: (b) => b.maxX, top: (b) => b.minY, angle: 45 },
    { id: "e", left: (b) => b.maxX, top: (b) => (b.minY + b.maxY) / 2, angle: 0 },
    { id: "se", left: (b) => b.maxX, top: (b) => b.maxY, angle: 135 },
    { id: "s", left: (b) => (b.minX + b.maxX) / 2, top: (b) => b.maxY, angle: 90 },
    { id: "sw", left: (b) => b.minX, top: (b) => b.maxY, angle: 45 },
    { id: "w", left: (b) => b.minX, top: (b) => (b.minY + b.maxY) / 2, angle: 0 },
];
const RESIZE_CURSORS = ["ew-resize", "nesw-resize", "ns-resize", "nwse-resize"];

// Which resize cursor points along a handle once the box is rotated.
const cursorFor = (handleAngle, rotation) => {
    const screenAngle = (((handleAngle - rotation) % 180) + 180) % 180;
    return RESIZE_CURSORS[Math.round(screenAngle / 45) % 4];
};

// Offset above the bounding box's top edge in screen pixels, fixed regardless of zoom.
const ROTATE_HANDLE_OFFSET = 28;
const QUICK_CONNECT_OFFSET = 22;
const QUICK_SIDES = [
    { side: "n", left: (w) => w / 2, top: () => -QUICK_CONNECT_OFFSET },
    { side: "e", left: (w) => w + QUICK_CONNECT_OFFSET, top: (_, h) => h / 2 },
    { side: "s", left: (w) => w / 2, top: (_, h) => h + QUICK_CONNECT_OFFSET },
    { side: "w", left: () => -QUICK_CONNECT_OFFSET, top: (_, h) => h / 2 },
];

// Only the handles take the pointer; moving comes from the canvas hit test. The wrapper turns with the
// element, so a rotated element keeps a box that fits.
const SelectionOverlay = ({ bounds, camera, showResizeHandles, locked, rotation = 0, handleIds = null, onResizeStart, onRotateStart, onQuickConnectStart }) => {
    if (!bounds) return null;

    const topLeft = worldToScreen(camera, bounds.minX, bounds.minY);
    const bottomRight = worldToScreen(camera, bounds.maxX, bounds.maxY);
    const screenBounds = { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y };
    const hideHandles = shouldHideHandles(screenBounds);
    const width = screenBounds.maxX - screenBounds.minX;
    const height = screenBounds.maxY - screenBounds.minY;
    const isAtRightAngle = rotation % 90 < 0.01 || rotation % 90 > 89.99;
    const shownHandles = handleIds ? HANDLES.filter((handle) => handleIds.includes(handle.id)) : HANDLES;

    return (
        <div className={styles.selectionLayer} data-locked={locked || undefined}>
            <div
                className={styles.rotatedGroup}
                style={{
                    left: screenBounds.minX,
                    top: screenBounds.minY,
                    width,
                    height,
                    transform: rotation ? `rotate(${rotation}deg)` : undefined,
                }}
            >
                <div className={styles.boundingBox} style={{ inset: 0 }} />
                {locked && (
                    <svg
                        className={styles.lockBadge}
                        style={{ left: 0, top: 0 }}
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        title="Locked"
                    >
                        <rect x="5" y="11" width="14" height="9" rx="1.5" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                )}
                {!hideHandles &&
                    showResizeHandles &&
                    shownHandles.map((handle) => (
                        <div
                            key={handle.id}
                            className={styles.handle}
                            data-selection-handle="true"
                            style={{
                                left: handle.left(screenBounds) - screenBounds.minX,
                                top: handle.top(screenBounds) - screenBounds.minY,
                                cursor: cursorFor(handle.angle, rotation),
                                transform: "translate(-50%, -50%)",
                            }}
                            onPointerDown={(e) => onResizeStart(handle.id, e)}
                        />
                    ))}
                {!hideHandles && onRotateStart && (
                    <>
                        <div
                            className={styles.rotateHandleStem}
                            data-snapped={isAtRightAngle || undefined}
                            style={{ left: width / 2, top: -ROTATE_HANDLE_OFFSET, height: ROTATE_HANDLE_OFFSET }}
                        />
                        <div
                            className={styles.rotateHandle}
                            data-selection-handle="true"
                            data-snapped={isAtRightAngle || undefined}
                            style={{ left: width / 2, top: -ROTATE_HANDLE_OFFSET, transform: "translate(-50%, -50%)" }}
                            onPointerDown={onRotateStart}
                            title={isAtRightAngle ? `Drag to rotate (at ${Math.round(rotation)}°)` : "Drag to rotate"}
                        />
                    </>
                )}
                {!hideHandles &&
                    onQuickConnectStart &&
                    QUICK_SIDES.map(({ side, left, top }) => {
                        // The rotate handle already sits above the box, so its dot moves aside.
                        const shift = side === "n" ? 18 : 0;
                        return (
                            <div
                                key={side}
                                role="button"
                                aria-label={`Add a connected copy to the ${{ n: "top", e: "right", s: "bottom", w: "left" }[side]}`}
                                title="Click to add a connected copy, drag to connect"
                                className={styles.quickConnect}
                                data-selection-handle="true"
                                style={{ left: left(width, height) + shift, top: top(width, height) }}
                                onPointerDown={(e) => onQuickConnectStart(side, e)}
                            />
                        );
                    })}
            </div>
        </div>
    );
};

export default SelectionOverlay;
