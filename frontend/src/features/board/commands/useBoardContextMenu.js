import { useCallback, useRef, useState } from "react";

const PAN_TRAVEL_PX = 4;

// A right press that didn't turn into a pan opens the board's menu.
export const useBoardContextMenu = (board) => {
    const { elements, getCanvasCoordinates, getElementAtPoint, getSelectionTolerance, lastPointerWorldRef, selectedElementIds, setSelectedElementIds } = board;
    const [contextMenu, setContextMenu] = useState(null);
    const rightPressRef = useRef(null);

    const noteRightPress = useCallback((e) => {
        rightPressRef.current = { x: e.clientX, y: e.clientY, travelled: 0 };
    }, []);

    const noteRightDrag = useCallback((e) => {
        const press = rightPressRef.current;
        if (press) press.travelled = Math.max(press.travelled, Math.hypot(e.clientX - press.x, e.clientY - press.y));
    }, []);

    const handleContextMenu = useCallback(
        (e) => {
            e.preventDefault();
            if (rightPressRef.current?.travelled > PAN_TRAVEL_PX) {
                rightPressRef.current = null;
                return;
            }
            rightPressRef.current = null;
            const world = getCanvasCoordinates(e.clientX, e.clientY);
            lastPointerWorldRef.current = world;
            const hitId = getElementAtPoint(world.x, world.y, getSelectionTolerance);
            if (hitId && !selectedElementIds.includes(hitId)) {
                const group = elements[hitId]?.groupId;
                setSelectedElementIds(group ? Object.keys(elements).filter((id) => elements[id].groupId === group) : [hitId]);
            } else if (!hitId) {
                setSelectedElementIds([]);
            }
            setContextMenu({ x: e.clientX, y: e.clientY, onElement: Boolean(hitId) });
        },
        [getCanvasCoordinates, getElementAtPoint, getSelectionTolerance, lastPointerWorldRef, selectedElementIds, elements, setSelectedElementIds],
    );

    return { closeContextMenu: useCallback(() => setContextMenu(null), []), contextMenu, handleContextMenu, noteRightDrag, noteRightPress };
};
