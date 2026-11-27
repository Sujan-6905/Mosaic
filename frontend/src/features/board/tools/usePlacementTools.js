import { COLORS, MENU_ITEMS } from "./toolSettings";
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { useCallback, useRef } from "react";
import { menuItemClick } from "@/store/menuSlice";
import { DEFAULT_STICKY_SIZE, generateElementId, nextStickyColor, withSchemaV2Fields } from "../state/boardHelpers";
import { DEFAULT_TABLE_SIZE } from "../../../../../shared/canvas/elements/table.js";
import { newTableFields } from "../text/tableLayout";

const DRAG_THRESHOLD_PX = 6;
const MIN_STICKY_SIZE = 48;
const NEW_TEXT_SIZE = 20;
const MIN_TABLE_CELL = 24;

const rectFromDrag = (start, x, y, square) => {
    let width = Math.abs(x - start.x);
    let height = Math.abs(y - start.y);
    if (square) width = height = Math.max(width, height);
    return { x: x >= start.x ? start.x : start.x - width, y: y >= start.y ? start.y : start.y - height, width, height };
};

// The text, sticky and table tools: press and release to drop one at its default size,
// or drag out the box you want first.
export const usePlacementTools = (board) => {
    const {
        addElement,
        cameraRef,
        clearOverlayCanvas,
        color,
        dispatch,
        elements,
        openTextEditor,
        overlayModeRef,
        overlayShapeRef,
        setElements,
        setSelectedElementIds,
    } = board;
    const placementRef = useRef(null);

    const stickyDraft = useCallback(
        (rect) =>
            withSchemaV2Fields(
                {
                    type: "sticky",
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    text: "",
                    color: COLORS.BLACK,
                    fillColor: nextStickyColor(elements),
                    fillColorToken: null,
                    size: 16,
                    fontFamily: FONT_FAMILIES[0],
                    fontWeight: "normal",
                    fontStyle: "normal",
                    underline: false,
                    strikethrough: false,
                    align: "left",
                },
                elements,
            ),
        [elements],
    );

    // A new text box lives only on this client until it has words in it, so an
    // abandoned one leaves no trace for anyone, including the undo stack.
    const createText = useCallback(
        (x, y, width = null) => {
            const elementId = generateElementId();
            const textElement = withSchemaV2Fields(
                {
                    type: "text",
                    x,
                    y,
                    width: width ?? 8,
                    autoWidth: width === null,
                    text: "",
                    color,
                    size: NEW_TEXT_SIZE,
                    fontFamily: FONT_FAMILIES[0],
                    fontWeight: "normal",
                    fontStyle: "normal",
                    underline: false,
                    strikethrough: false,
                    align: "left",
                    opacity: 100,
                },
                elements,
            );
            setElements((prev) => ({ ...prev, [elementId]: textElement }));
            openTextEditor(elementId, textElement, { isNew: true });
        },
        [color, elements, setElements, openTextEditor],
    );

    // A click drops a three by three table centred there; a drag sets its size.
    const placeTable = useCallback(
        (rect, at) => {
            const { rows, cols, colWidth, rowHeight } = DEFAULT_TABLE_SIZE;
            const box =
                rect && rect.width >= cols * MIN_TABLE_CELL && rect.height >= rows * MIN_TABLE_CELL
                    ? rect
                    : { x: at.x - (cols * colWidth) / 2, y: at.y - (rows * rowHeight) / 2, width: cols * colWidth, height: rows * rowHeight };
            const elementId = generateElementId();
            const table = withSchemaV2Fields(newTableFields(box), elements);
            addElement(elementId, table);
            setSelectedElementIds([elementId]);
            openTextEditor(elementId, table, { cell: { row: 0, col: 0 } });
        },
        [elements, addElement, setSelectedElementIds, openTextEditor],
    );

    const beginPlacement = useCallback(
        (kind, x, y) => {
            placementRef.current = { kind, x, y };
            overlayModeRef.current = kind === MENU_ITEMS.STICKY ? "shape" : "marquee";
            overlayShapeRef.current = null;
            clearOverlayCanvas();
        },
        [overlayModeRef, overlayShapeRef, clearOverlayCanvas],
    );

    const movePlacement = useCallback(
        (x, y, e) => {
            const start = placementRef.current;
            const rect = rectFromDrag(start, x, y, e.shiftKey);
            if (start.kind === MENU_ITEMS.STICKY) {
                overlayShapeRef.current = stickyDraft(rect);
            } else {
                overlayShapeRef.current = { startX: start.x, startY: start.y, endX: x, endY: y };
            }
        },
        [overlayShapeRef, stickyDraft],
    );

    const finishPlacement = useCallback(
        (x, y, e) => {
            const start = placementRef.current;
            placementRef.current = null;
            overlayModeRef.current = null;
            overlayShapeRef.current = null;
            clearOverlayCanvas();
            const threshold = DRAG_THRESHOLD_PX / cameraRef.current.zoom;
            const dragged = Math.abs(x - start.x) > threshold || Math.abs(y - start.y) > threshold;
            dispatch(menuItemClick(MENU_ITEMS.SELECT));
            if (start.kind === MENU_ITEMS.TEXT) {
                if (dragged) {
                    const rect = rectFromDrag(start, x, y, false);
                    createText(rect.x, rect.y, rect.width);
                } else {
                    createText(start.x, start.y);
                }
                return;
            }
            if (start.kind === MENU_ITEMS.TABLE) {
                placeTable(dragged ? rectFromDrag(start, x, y, false) : null, start);
                return;
            }
            let rect;
            if (dragged) {
                const dragRect = rectFromDrag(start, x, y, e?.shiftKey);
                rect = { ...dragRect, width: Math.max(MIN_STICKY_SIZE, dragRect.width), height: Math.max(MIN_STICKY_SIZE, dragRect.height) };
            } else {
                rect = { x: start.x - DEFAULT_STICKY_SIZE / 2, y: start.y - DEFAULT_STICKY_SIZE / 2, width: DEFAULT_STICKY_SIZE, height: DEFAULT_STICKY_SIZE };
            }
            const elementId = generateElementId();
            const sticky = stickyDraft(rect);
            addElement(elementId, sticky);
            setSelectedElementIds([elementId]);
            openTextEditor(elementId, sticky);
        },
        [
            overlayModeRef,
            overlayShapeRef,
            clearOverlayCanvas,
            cameraRef,
            dispatch,
            createText,
            placeTable,
            stickyDraft,
            addElement,
            setSelectedElementIds,
            openTextEditor,
        ],
    );

    return { beginPlacement, createText, finishPlacement, movePlacement, placementRef };
};
