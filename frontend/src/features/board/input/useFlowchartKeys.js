import { useCallback } from "react";
import { boundsCenter, getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { canQuickConnect } from "../tools/useConnectorTools";

const SIDE_FOR_KEY = { ArrowUp: "n", ArrowRight: "e", ArrowDown: "s", ArrowLeft: "w" };
const DIRECTION = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const SHAPE_CYCLE = ["Rectangle", "Diamond", "Ellipse", "Hexagon", "Parallelogram", "Cylinder", "Document", "Cloud"];

// Ctrl and an arrow grows a connected copy that way, Alt and an arrow moves to the connected shape,
// and Tab turns the selected shapes into the next kind.
export const useFlowchartKeys = (board) => {
    const { applyElementUpdates, elements, finishQuickConnect, selectedElementIds, setSelectedElementIds } = board;

    const growFlowchart = useCallback(
        (key) => {
            const id = selectedElementIds.length === 1 ? selectedElementIds[0] : null;
            if (!id || !canQuickConnect(elements[id]) || elements[id].locked) return false;
            finishQuickConnect({ elementId: id, quick: { side: SIDE_FOR_KEY[key] } }, 0, 0, false);
            return true;
        },
        [elements, selectedElementIds, finishQuickConnect],
    );

    const selectConnectedToward = useCallback(
        (key) => {
            const id = selectedElementIds.length === 1 ? selectedElementIds[0] : null;
            const from = id && getElementBounds(elements[id]);
            if (!from) return false;
            const origin = boundsCenter(from);
            const [dx, dy] = DIRECTION[SIDE_FOR_KEY[key]];
            let best = null;
            Object.values(elements).forEach((connector) => {
                if (connector.type !== "connector") return;
                const other = connector.startElementId === id ? connector.endElementId : connector.endElementId === id ? connector.startElementId : null;
                const bounds = other && elements[other] && getElementBounds(elements[other]);
                if (!bounds) return;
                const center = boundsCenter(bounds);
                const along = (center.x - origin.x) * dx + (center.y - origin.y) * dy;
                const across = Math.abs((center.x - origin.x) * dy - (center.y - origin.y) * dx);
                if (along <= 0) return;
                const score = along + across * 2;
                if (!best || score < best.score) best = { id: other, score };
            });
            if (!best) return false;
            setSelectedElementIds([best.id]);
            return true;
        },
        [elements, selectedElementIds, setSelectedElementIds],
    );

    const cycleShapeKind = useCallback(
        (backwards) => {
            const shapes = selectedElementIds.filter(
                (id) => elements[id]?.type === "shape" && SHAPE_CYCLE.includes(elements[id].shapeType) && !elements[id].locked,
            );
            if (shapes.length === 0 || shapes.length !== selectedElementIds.length) return false;
            const step = backwards ? SHAPE_CYCLE.length - 1 : 1;
            applyElementUpdates(
                Object.fromEntries(
                    shapes.map((id) => [
                        id,
                        { ...elements[id], shapeType: SHAPE_CYCLE[(SHAPE_CYCLE.indexOf(elements[id].shapeType) + step) % SHAPE_CYCLE.length] },
                    ]),
                ),
            );
            return true;
        },
        [elements, selectedElementIds, applyElementUpdates],
    );

    return { cycleShapeKind, growFlowchart, selectConnectedToward };
};
