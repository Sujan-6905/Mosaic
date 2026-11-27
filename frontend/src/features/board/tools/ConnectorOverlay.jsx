import { connectorLabelPoint, resolveConnectorPolyline } from "../../../../../shared/canvas/elements/connectors";
import { worldToScreen } from "../camera/camera";
import styles from "../selection/SelectionOverlay.module.css";

const LABEL_CLEARANCE_PX = 30;

const Dot = ({ point, camera, className, label, onPointerDown, onDoubleClick, opensLabel }) => {
    const screen = worldToScreen(camera, point.x, point.y);
    return (
        <div
            role="button"
            aria-label={label}
            title={label}
            data-selection-handle="true"
            data-opens-label={opensLabel || undefined}
            className={className}
            style={{ left: screen.x, top: screen.y }}
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
        />
    );
};

// A selected arrow's own handles: its two ends, which can be dragged onto other
// elements, and the points that shape its path.
const ConnectorOverlay = ({ connector, elements, camera, onEndpointStart, onBendStart, onElbowStart, onRemoveBend }) => {
    const polyline = resolveConnectorPolyline(connector, elements);
    if (polyline.length < 2) return null;
    const waypoints = connector.waypoints || [];
    const nodes = [{ x: connector.startX, y: connector.startY }, ...waypoints, { x: connector.endX, y: connector.endY }];
    const isElbow = connector.routing === "elbow";
    const midHandles = [];
    if (!isElbow) {
        if (connector.routing === "curved" && waypoints.length === 0) {
            midHandles.push({ point: polyline[Math.floor(polyline.length / 2)], index: 0 });
        } else {
            for (let i = 1; i < nodes.length; i += 1) {
                midHandles.push({ point: { x: (nodes[i - 1].x + nodes[i].x) / 2, y: (nodes[i - 1].y + nodes[i].y) / 2 }, index: i - 1 });
            }
        }
    }
    // A bend handle sitting on the label would take the press meant for moving it,
    // so it steps aside along the line.
    if (connector.text) {
        const label = connectorLabelPoint(connector, polyline);
        const clearance = LABEL_CLEARANCE_PX / camera.zoom;
        midHandles.forEach((handle) => {
            if (Math.hypot(handle.point.x - label.x, handle.point.y - label.y) >= clearance) return;
            const from = nodes[handle.index];
            handle.point = { x: (from.x + handle.point.x) / 2, y: (from.y + handle.point.y) / 2 };
        });
    }
    const elbowSpan = isElbow && polyline.length === 4 ? [polyline[1], polyline[2]] : null;
    const elbowHorizontal = elbowSpan && Math.abs(elbowSpan[0].x - elbowSpan[1].x) < 0.5;

    return (
        <div className={styles.selectionLayer}>
            {!isElbow &&
                midHandles.map(({ point, index }) => (
                    <Dot
                        key={`mid-${index}`}
                        point={point}
                        camera={camera}
                        className={styles.bendGhost}
                        label="Drag to bend this arrow"
                        opensLabel
                        onPointerDown={(e) => onBendStart(index, true, e)}
                    />
                ))}
            {!isElbow &&
                waypoints.map((point, index) => (
                    <Dot
                        key={`bend-${index}`}
                        point={point}
                        camera={camera}
                        className={styles.bendHandle}
                        label="Drag to reshape, double-click to remove"
                        onPointerDown={(e) => onBendStart(index, false, e)}
                        onDoubleClick={() => onRemoveBend(index)}
                    />
                ))}
            {elbowSpan && (
                <Dot
                    point={{ x: (elbowSpan[0].x + elbowSpan[1].x) / 2, y: (elbowSpan[0].y + elbowSpan[1].y) / 2 }}
                    camera={camera}
                    className={styles.bendHandle}
                    label="Drag to move this bend"
                    onPointerDown={(e) => onElbowStart(elbowHorizontal, e)}
                />
            )}
            <Dot
                point={polyline[0]}
                camera={camera}
                className={styles.endHandle}
                label="Arrow start: drag onto an element to attach"
                onPointerDown={(e) => onEndpointStart("start", e)}
            />
            <Dot
                point={polyline[polyline.length - 1]}
                camera={camera}
                className={styles.endHandle}
                label="Arrow end: drag onto an element to attach"
                onPointerDown={(e) => onEndpointStart("end", e)}
            />
        </div>
    );
};

export default ConnectorOverlay;
