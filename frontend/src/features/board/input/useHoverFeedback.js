import { CONNECTOR_TOOLS, MENU_ITEMS } from "../tools/toolSettings";
import { useCallback, useRef, useState } from "react";
import { getCachedElementBounds } from "../rendering/boundsCache";
import { isBoardChrome } from "../state/boardHelpers";

const LINK_HOVER_MARGIN_PX = 44;

// What the pointer is near while nothing is pressed: the element an arrow would
// attach to, and any link it could open.
export const useHoverFeedback = (board) => {
    const {
        activeMenuItem,
        bindTargetRef,
        cameraRef,
        clearOverlayCanvas,
        editingElementId,
        elements,
        findBindTarget,
        getElementAtPoint,
        getSelectionTolerance,
        hoverTargetRef,
        overlayModeRef,
        selectedElementIds,
        spatialIndexRef,
    } = board;
    const [hoveredLinkId, setHoveredLinkId] = useState(null);
    const hoveredLinkRef = useRef(null);

    const setHoveredLink = useCallback((id) => {
        if (hoveredLinkRef.current === id) return;
        hoveredLinkRef.current = id;
        setHoveredLinkId(id);
    }, []);

    // A thin outline round whatever a click would pick, before it's picked.
    const outlineUnderPointer = useCallback(
        (hitId) => {
            const target = hitId && !selectedElementIds.includes(hitId) ? hitId : null;
            if (target) {
                if (overlayModeRef.current && overlayModeRef.current !== "hover") return;
                if (hoverTargetRef.current === target && overlayModeRef.current === "hover") return;
                hoverTargetRef.current = target;
                overlayModeRef.current = "hover";
            } else if (overlayModeRef.current === "hover") {
                hoverTargetRef.current = null;
                overlayModeRef.current = null;
                clearOverlayCanvas();
            }
        },
        [selectedElementIds, overlayModeRef, hoverTargetRef, clearOverlayCanvas],
    );

    const updateHoverFeedback = useCallback(
        (point, e) => {
            if (CONNECTOR_TOOLS.includes(activeMenuItem) && !isBoardChrome(e.target)) {
                const target = findBindTarget(point.x, point.y);
                bindTargetRef.current = target;
                overlayModeRef.current = target ? "bindHover" : null;
                if (!target) clearOverlayCanvas();
            } else if (overlayModeRef.current === "bindHover") {
                bindTargetRef.current = null;
                overlayModeRef.current = null;
                clearOverlayCanvas();
            }

            if (activeMenuItem !== MENU_ITEMS.SELECT) {
                setHoveredLink(null);
                return;
            }
            if (isBoardChrome(e.target)) return;
            outlineUnderPointer(e.buttons === 0 && !editingElementId ? getElementAtPoint(point.x, point.y, getSelectionTolerance) : null);
            // Stays open across the short gap between the element and its card.
            const current = elements[hoveredLinkRef.current];
            const margin = LINK_HOVER_MARGIN_PX / cameraRef.current.zoom;
            const currentBounds = current && getCachedElementBounds(current);
            if (
                currentBounds &&
                point.x >= currentBounds.minX - margin &&
                point.x <= currentBounds.maxX + margin &&
                point.y >= currentBounds.minY - margin &&
                point.y <= currentBounds.maxY + margin
            )
                return;
            const linked = spatialIndexRef.current.queryPoint(point.x, point.y, 0).find((id) => elements[id]?.link);
            setHoveredLink(linked ?? null);
        },
        [
            activeMenuItem,
            findBindTarget,
            bindTargetRef,
            overlayModeRef,
            clearOverlayCanvas,
            elements,
            cameraRef,
            spatialIndexRef,
            setHoveredLink,
            outlineUnderPointer,
            editingElementId,
            getElementAtPoint,
            getSelectionTolerance,
        ],
    );

    return { hoveredLinkId, updateHoverFeedback };
};
