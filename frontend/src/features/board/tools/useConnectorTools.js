import { CONNECTOR_TOOLS, DEFAULT_DRAW_STYLE, MENU_ITEMS } from "./toolSettings";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import { colorTokenFor } from "../rendering/colorResolver";
import {
    anchorToWorld,
    connectorLabelPlacementAt,
    nearestOnPolyline,
    resolveConnectorPolyline,
    withConnectorHeads,
} from "../../../../../shared/canvas/elements/connectors";
import { translateElement, worldPointToElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { boundsCenter, getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { generateElementId, withSchemaV2Fields } from "../state/boardHelpers";
import { isClosedShape } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

const ANCHOR_SNAP_PX = 14;
const CLICK_DRAG_PX = 6;
const ADJACENT_GAP = 80;
const COLLINEAR_PX = 8;
const LABEL_LINE_SNAP_PX = 10;
const SIDE_VECTORS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const SNAP_FRACTIONS = [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
];

export const canQuickConnect = (element) => isClosedShape(element) || element?.type === "sticky";

// Straight bends that line up with their neighbours are just noise, so dropping
// one back onto the line removes it.
const withoutCollinearBend = (start, end, waypoints, index, tolerance) => {
    const point = waypoints[index];
    const before = waypoints[index - 1] ?? start;
    const after = waypoints[index + 1] ?? end;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const distance = Math.abs((point.x - before.x) * dy - (point.y - before.y) * dx) / length;
    return distance <= tolerance ? waypoints.filter((_, i) => i !== index) : waypoints;
};

export const useConnectorTools = (board) => {
    const {
        activeMenuItem,
        addGeneratedElements,
        beginElementDrag,
        bindTargetRef,
        cameraRef,
        clearOverlayCanvas,
        color,
        connectorStart,
        currentElementId,
        dragStateRef,
        elements,
        finishToolUse,
        getElementAtPoint,
        getSelectionTolerance,
        hasEditAccess,
        isDrawingConnector,
        opacity,
        overlayModeRef,
        overlayShapeRef,
        selectedElementIds,
        setSelectedElementIds,
        size,
        getCanvasCoordinates,
        addElement,
    } = board;
    const drawStyle = useSelector((state) => state.toolbox.drawStyle) ?? DEFAULT_DRAW_STYLE;
    const arrowTool = useSelector((state) => state.toolbox[MENU_ITEMS.ARROW]);

    // What a pointer at (x, y) would bind to: the topmost element under it, and
    // where on that element. Near the middle or an edge midpoint it snaps there.
    const findBindTarget = useCallback(
        (x, y, excludeIds = []) => {
            const exclude = new Set(excludeIds);
            const hitId = getElementAtPoint(x, y, getSelectionTolerance, (id, element) => !exclude.has(id) && element.type !== "frame");
            if (!hitId) return null;
            const element = elements[hitId];
            if (element.type === "connector") {
                const { fraction, point } = nearestOnPolyline(resolveConnectorPolyline(element, elements), { x, y });
                return { elementId: hitId, anchor: { t: fraction }, point };
            }
            const bounds = getElementBounds(element);
            const width = bounds.maxX - bounds.minX || 1;
            const height = bounds.maxY - bounds.minY || 1;
            const local = worldPointToElement(element, { x, y });
            const snapWorld = ANCHOR_SNAP_PX / cameraRef.current.zoom;
            const center = boundsCenter(bounds);
            let anchor = null;
            if (Math.hypot(local.x - center.x, local.y - center.y) > snapWorld) {
                const snapped = SNAP_FRACTIONS.find(
                    ([fx, fy]) => Math.hypot(local.x - (bounds.minX + width * fx), local.y - (bounds.minY + height * fy)) <= snapWorld,
                );
                anchor = snapped
                    ? { x: snapped[0], y: snapped[1] }
                    : { x: Math.min(1, Math.max(0, (local.x - bounds.minX) / width)), y: Math.min(1, Math.max(0, (local.y - bounds.minY) / height)) };
            }
            return { elementId: hitId, anchor, point: anchorToWorld(element, anchor, elements) };
        },
        [elements, getElementAtPoint, getSelectionTolerance, cameraRef],
    );

    const connectorFields = useCallback(
        (tool) => {
            const isLine = tool === MENU_ITEMS.LINE;
            const style = CONNECTOR_TOOLS.includes(tool) ? { color, size, opacity } : arrowTool;
            return withConnectorHeads({
                color: style.color,
                colorToken: colorTokenFor(style.color) ?? null,
                size: style.size,
                opacity: style.opacity,
                strokeStyle: drawStyle.strokeStyle,
                roughness: drawStyle.roughness,
                routing: drawStyle.routing,
                startHead: isLine ? "none" : drawStyle.startHead,
                endHead: isLine ? "none" : drawStyle.endHead,
            });
        },
        [color, size, opacity, arrowTool, drawStyle],
    );

    const connectorBetween = useCallback(
        (tool, start, end) => ({
            type: "connector",
            startX: start.point?.x ?? start.x,
            startY: start.point?.y ?? start.y,
            endX: end.point?.x ?? end.x,
            endY: end.point?.y ?? end.y,
            startElementId: start.elementId ?? null,
            endElementId: end.elementId ?? null,
            startAnchor: start.anchor ?? null,
            endAnchor: end.anchor ?? null,
            ...connectorFields(tool),
        }),
        [connectorFields],
    );

    const beginConnector = useCallback(
        (x, y) => {
            const target = findBindTarget(x, y);
            isDrawingConnector.current = true;
            connectorStart.current = { x, y, elementId: target?.elementId ?? null, anchor: target?.anchor ?? null, point: target?.point ?? null, quick: null };
            currentElementId.current = generateElementId();
            bindTargetRef.current = null;
            overlayModeRef.current = "shape";
            overlayShapeRef.current = null;
            clearOverlayCanvas();
        },
        [findBindTarget, isDrawingConnector, connectorStart, currentElementId, overlayModeRef, overlayShapeRef, clearOverlayCanvas, bindTargetRef],
    );

    const moveConnector = useCallback(
        (x, y) => {
            const start = connectorStart.current;
            const exclude = start.elementId ? [start.elementId] : [];
            const target = findBindTarget(x, y, exclude);
            bindTargetRef.current = target;
            const tool = start.quick ? MENU_ITEMS.ARROW : activeMenuItem;
            overlayShapeRef.current = connectorBetween(tool, start, target ?? { x, y });
        },
        [connectorStart, findBindTarget, activeMenuItem, overlayShapeRef, connectorBetween, bindTargetRef],
    );

    // A copy of `source` centred on a point, ready to be typed into.
    const cloneAt = useCallback(
        (source, sourceId, point) => {
            const center = boundsCenter(getElementBounds(source));
            const { text, subtext, link, ...rest } = translateElement(source, point.x - center.x, point.y - center.y);
            void text;
            void subtext;
            void link;
            return { ...rest, ...(source.type === "sticky" ? { text: "" } : {}), zIndex: nextZIndex(elements), groupId: null, frameId: null, locked: false };
        },
        [elements],
    );

    const finishQuickConnect = useCallback(
        (start, x, y, dragged) => {
            const source = elements[start.elementId];
            if (!source) return;
            const bounds = getElementBounds(source);
            const target = dragged ? findBindTarget(x, y, [start.elementId]) : null;
            if (target) {
                const id = generateElementId();
                const connector = withSchemaV2Fields(connectorBetween(MENU_ITEMS.ARROW, start, target), elements);
                addElement(id, connector);
                setSelectedElementIds([id]);
                return;
            }
            const [sideX, sideY] = SIDE_VECTORS[start.quick.side];
            const center = boundsCenter(bounds);
            const reachX = bounds.maxX - bounds.minX + ADJACENT_GAP;
            const reachY = bounds.maxY - bounds.minY + ADJACENT_GAP;
            const point = dragged ? { x, y } : { x: center.x + sideX * reachX, y: center.y + sideY * reachY };
            const cloneId = generateElementId();
            const clone = cloneAt(source, start.elementId, point);
            const created = [{ elementId: cloneId, element: clone }];
            // Tapping a note's dot just adds the next note; only an arrow drag connects them.
            if (source.type !== "sticky" || dragged) {
                const connector = withSchemaV2Fields(
                    connectorBetween(
                        MENU_ITEMS.ARROW,
                        { elementId: start.elementId, anchor: null, point: center },
                        { elementId: cloneId, anchor: null, point },
                    ),
                    { ...elements, [cloneId]: clone },
                );
                created.push({ elementId: generateElementId(), element: connector });
            }
            addGeneratedElements(created);
            setSelectedElementIds([cloneId]);
        },
        [elements, findBindTarget, connectorBetween, addElement, setSelectedElementIds, cloneAt, addGeneratedElements],
    );

    const finishConnector = useCallback(
        (x, y) => {
            const start = connectorStart.current;
            isDrawingConnector.current = false;
            connectorStart.current = null;
            bindTargetRef.current = null;
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            const elementId = currentElementId.current;
            currentElementId.current = null;
            const dragged = Math.hypot(x - start.x, y - start.y) * cameraRef.current.zoom > CLICK_DRAG_PX;
            if (start.quick) {
                finishQuickConnect(start, x, y, dragged);
                return;
            }
            if (!dragged) return;
            const exclude = start.elementId ? [start.elementId] : [];
            const end = findBindTarget(x, y, exclude) ?? { x, y };
            addElement(elementId, withSchemaV2Fields(connectorBetween(activeMenuItem, start, end), elements));
            finishToolUse([elementId]);
        },
        [
            connectorStart,
            isDrawingConnector,
            overlayModeRef,
            overlayShapeRef,
            clearOverlayCanvas,
            currentElementId,
            cameraRef,
            finishQuickConnect,
            findBindTarget,
            addElement,
            connectorBetween,
            activeMenuItem,
            elements,
            finishToolUse,
            bindTargetRef,
        ],
    );

    // Dragging one of a selected shape's side dots: an arrow out of it, which
    // lands on another element or makes a new copy where it's dropped.
    const beginQuickConnect = useCallback(
        (side, e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!hasEditAccess || selectedElementIds.length !== 1) return;
            const sourceId = selectedElementIds[0];
            const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
            const center = boundsCenter(getElementBounds(elements[sourceId]));
            isDrawingConnector.current = true;
            connectorStart.current = { x, y, elementId: sourceId, anchor: null, point: center, quick: { side } };
            currentElementId.current = generateElementId();
            overlayModeRef.current = "shape";
            overlayShapeRef.current = null;
            clearOverlayCanvas();
        },
        [
            hasEditAccess,
            selectedElementIds,
            getCanvasCoordinates,
            elements,
            isDrawingConnector,
            connectorStart,
            currentElementId,
            overlayModeRef,
            overlayShapeRef,
            clearOverlayCanvas,
        ],
    );

    const startConnectorDrag = useCallback(
        (e, edit) => {
            e.stopPropagation();
            e.preventDefault();
            const id = selectedElementIds[0];
            const connector = elements[id];
            if (!hasEditAccess || !connector || connector.locked) return;
            dragStateRef.current = {
                mode: "connectorEdit",
                ids: [id],
                originalElements: { [id]: connector },
                hidden: true,
                edit: (x, y) => edit(connector, x, y, id),
            };
            beginElementDrag([id], { [id]: connector }, elements);
        },
        [selectedElementIds, elements, hasEditAccess, dragStateRef, beginElementDrag],
    );

    const beginEndpointDrag = useCallback(
        (end, e) => {
            startConnectorDrag(e, (connector, x, y, id) => {
                const otherId = end === "start" ? connector.endElementId : connector.startElementId;
                const target = findBindTarget(x, y, [id, ...(otherId ? [otherId] : [])]);
                bindTargetRef.current = target;
                const point = target?.point ?? { x, y };
                return end === "start"
                    ? { ...connector, startX: point.x, startY: point.y, startElementId: target?.elementId ?? null, startAnchor: target?.anchor ?? null }
                    : { ...connector, endX: point.x, endY: point.y, endElementId: target?.elementId ?? null, endAnchor: target?.anchor ?? null };
            });
        },
        [startConnectorDrag, findBindTarget, bindTargetRef],
    );

    // `insert` adds a new bend at `index`; otherwise the bend already there moves.
    const beginBendDrag = useCallback(
        (index, insert, e) => {
            startConnectorDrag(e, (connector, x, y) => {
                const waypoints = [...(connector.waypoints || [])];
                if (insert) waypoints.splice(index, 0, { x, y });
                else waypoints[index] = { x, y };
                const start = { x: connector.startX, y: connector.startY };
                const end = { x: connector.endX, y: connector.endY };
                return {
                    ...connector,
                    routing: connector.routing || "straight",
                    waypoints: withoutCollinearBend(start, end, waypoints, index, COLLINEAR_PX / cameraRef.current.zoom),
                };
            });
        },
        [startConnectorDrag, cameraRef],
    );

    const beginElbowDrag = useCallback(
        (horizontal, e) => {
            startConnectorDrag(e, (connector, x, y) => {
                const span = horizontal ? connector.endX - connector.startX : connector.endY - connector.startY;
                const moved = horizontal ? x - connector.startX : y - connector.startY;
                return { ...connector, elbowBias: span === 0 ? 0.5 : Math.min(1, Math.max(0, moved / span)) };
            });
        },
        [startConnectorDrag],
    );

    // Starts lazily, on the first real movement, so a click or double-click on a
    // label stays a click. Near the line it settles back onto it.
    const beginLabelDrag = useCallback(
        (id) => {
            const connector = elements[id];
            if (!hasEditAccess || !connector || connector.locked) return;
            dragStateRef.current = {
                mode: "connectorEdit",
                ids: [id],
                originalElements: { [id]: connector },
                hidden: false,
                edit: (x, y) => {
                    const placement = connectorLabelPlacementAt(resolveConnectorPolyline(connector, elements), { x, y });
                    const onLine = Math.abs(placement.labelOffset) <= LABEL_LINE_SNAP_PX / cameraRef.current.zoom;
                    return { ...connector, ...placement, labelOffset: onLine ? 0 : placement.labelOffset };
                },
            };
        },
        [elements, hasEditAccess, dragStateRef, cameraRef],
    );

    return {
        beginBendDrag,
        beginLabelDrag,
        beginConnector,
        beginElbowDrag,
        beginEndpointDrag,
        beginQuickConnect,
        drawStyle,
        findBindTarget,
        finishConnector,
        finishQuickConnect,
        moveConnector,
    };
};
