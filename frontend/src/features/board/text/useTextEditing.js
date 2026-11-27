import { createTextCollabSession, encodeUpdateToBase64 } from "./textCollab";
import { getPaintBounds } from "../rendering/boundsCache";
import { shapeHeightFor, stickyHeightFor } from "./textFit";
import { socket } from "@/lib/socket.js";
import { useCallback, useRef, useState } from "react";
import { cellIndex, insertRow } from "../../../../../shared/canvas/elements/table.js";
import { tableLayout } from "./tableLayout";

const TEXT_EDIT_FLUSH_DEBOUNCE_MS = 800;
const AUTO_WIDTH_PADDING = 6;

// Applied when the editor closes rather than as the words change.
const carriesItsOwnText = (element) => element.type === "shape" || element.type === "connector" || element.type === "table";

const heightOf = (element) => (element.type === "sticky" ? element.height : Math.abs(element.endY - element.startY));

// Grows a note or shape to hold its text, and back down as the text shrinks, but
// never below the height it had before the text pushed it.
const withFittedHeight = (element, draft) => {
    const merged = { ...element, ...draft };
    if (merged.type === "sticky") {
        const baseHeight = merged.autoHeightBase ?? merged.height;
        const height = stickyHeightFor(merged, baseHeight);
        return { ...draft, height, autoHeightBase: height > baseHeight ? baseHeight : null };
    }
    if (merged.type === "shape") {
        const baseHeight = merged.autoHeightBase ?? heightOf(merged);
        const height = shapeHeightFor(merged, baseHeight);
        const top = Math.min(merged.startY, merged.endY);
        return { ...draft, startY: top, endY: top + height, autoHeightBase: height > baseHeight ? baseHeight : null };
    }
    return draft;
};

let measureContext = null;
const measuredTextWidth = (element) => {
    if (typeof document === "undefined") return element.width;
    if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
    const weight = element.fontWeight === "bold" ? "bold " : "";
    const style = element.fontStyle === "italic" ? "italic " : "";
    measureContext.font = `${style}${weight}${element.size || 16}px ${element.fontFamily || "Arial, sans-serif"}`;
    const widest = (element.text || "").split("\n").reduce((max, line) => Math.max(max, measureContext.measureText(line).width), 0);
    return Math.ceil(widest) + AUTO_WIDTH_PADDING;
};

export const useTextEditing = (board) => {
    const {
        addElement,
        applyElementUpdates,
        editingDraft,
        editingElementId,
        editingGeometryRef,
        editingTextIdRef,
        elements,
        spatialIndexRef,
        removeElement,
        requestStaticFullRepaint,
        roomJoined,
        setEditingDraft,
        setEditingElementId,
        setElements,
        setSelectedElementIds,
        shareId,
        staticNeedsFullRepaintRef,
        textCollabSessionRef,
        textEditFlushTimerRef,
        tileRendererRef,
    } = board;
    // The id of a text box not yet on the board for anyone else.
    const newTextIdRef = useRef(null);
    // The table cell being typed in, as { row, col }.
    const [editingCell, setEditingCell] = useState(null);

    const flushTextEditDraft = useCallback(() => {
        if (!editingElementId || !editingDraft || !elements[editingElementId]) return;
        if (newTextIdRef.current === editingElementId || carriesItsOwnText(elements[editingElementId])) return;
        applyElementUpdates({ [editingElementId]: { ...elements[editingElementId], ...editingDraft } });
    }, [editingElementId, editingDraft, elements, applyElementUpdates]);

    // The board draws the element under edit without its words, whose only
    // visible copy is the textarea above it, so its tiles redraw on open and close.
    const repaintElement = useCallback(
        (element) => {
            const bounds = getPaintBounds(element);
            if (bounds) tileRendererRef.current?.invalidateBounds(bounds);
            staticNeedsFullRepaintRef.current = true;
        },
        [staticNeedsFullRepaintRef, tileRendererRef],
    );

    // The board draws the table at the height its words need, with the open
    // cell left empty for the textarea above it.
    const showTableDraft = useCallback(
        (elementId, table, cell) => {
            const top = Math.min(table.startY, table.endY);
            const fitted = { ...table, endY: top + Math.max(Math.abs(table.endY - table.startY), tableLayout(table).natural) };
            const before = { ...table, ...editingGeometryRef.current };
            editingGeometryRef.current = {
                endY: fitted.endY,
                cells: table.cells.map((text, index) => (index === cellIndex(table, cell.row, cell.col) ? "" : text)),
            };
            spatialIndexRef.current.update(elementId, fitted);
            repaintElement(before);
            repaintElement(fitted);
            return fitted;
        },
        [editingGeometryRef, spatialIndexRef, repaintElement],
    );

    // `elementOverride` opens a just-added element before React commits it; `isNew` marks a text box
    // that only joins the board once it has words.
    const openTextEditor = useCallback(
        (elementId, elementOverride, { isNew = false, cell = null } = {}) => {
            const element = elementOverride || elements[elementId];
            if (!element || element.locked) return;
            newTextIdRef.current = isNew ? elementId : null;
            setEditingElementId(elementId);
            editingTextIdRef.current = elementId;
            repaintElement(element);
            if (element.type === "table") {
                const opened = cell ?? { row: 0, col: 0 };
                setEditingCell(opened);
                const fitted = showTableDraft(elementId, element, opened);
                setEditingDraft({
                    cells: element.cells,
                    rows: element.rows,
                    endY: fitted.endY,
                    fontFamily: element.fontFamily,
                    fontWeight: element.fontWeight,
                    fontStyle: element.fontStyle,
                    align: element.align,
                    size: element.size,
                });
                textCollabSessionRef.current?.destroy();
                textCollabSessionRef.current = null;
                return;
            }
            setEditingCell(null);
            setEditingDraft({
                text: element.text ?? "",
                fontFamily: element.fontFamily,
                fontWeight: element.fontWeight,
                fontStyle: element.fontStyle,
                align: element.align,
                ...(carriesItsOwnText(element)
                    ? { fontSize: element.fontSize }
                    : { size: element.size, underline: element.underline, strikethrough: element.strikethrough, width: element.width }),
            });
            textCollabSessionRef.current?.destroy();
            textCollabSessionRef.current = null;
            if (roomJoined && shareId && !isNew && !carriesItsOwnText(element)) {
                textCollabSessionRef.current = createTextCollabSession({
                    initialText: element.text,
                    emitUpdate: (update) => {
                        socket.emit("client:textSync", { shareId, elementId, update: encodeUpdateToBase64(update) });
                    },
                    onRemoteText: (text) => {
                        setEditingDraft((prev) => (prev ? { ...prev, text } : prev));
                    },
                });
                socket.emit("client:textSync", {
                    shareId,
                    elementId,
                    update: encodeUpdateToBase64(textCollabSessionRef.current.openingRequest()),
                    wantsState: true,
                });
            }
        },
        [elements, roomJoined, shareId, repaintElement, showTableDraft, editingTextIdRef, setEditingDraft, setEditingElementId, textCollabSessionRef],
    );

    const scheduleTextEditFlush = useCallback(() => {
        if (textEditFlushTimerRef.current) clearTimeout(textEditFlushTimerRef.current);
        textEditFlushTimerRef.current = setTimeout(() => {
            textEditFlushTimerRef.current = null;
            flushTextEditDraft();
        }, TEXT_EDIT_FLUSH_DEBOUNCE_MS);
    }, [flushTextEditDraft, textEditFlushTimerRef]);

    // Holds the words as they change: a text box widens, and a note or shape
    // shrinks its text and then grows, with the growing outline drawn at once.
    const fitDraft = useCallback(
        (draft) => {
            const element = elements[editingElementId];
            if (!element) return draft;
            if (element.autoWidth) return { ...draft, width: measuredTextWidth({ ...element, ...draft }) };
            const fitted = withFittedHeight(element, draft);
            if (element.type !== "sticky" && element.type !== "shape") return fitted;
            const geometry = element.type === "sticky" ? { height: fitted.height } : { startY: fitted.startY, endY: fitted.endY };
            const shownBefore = { ...element, ...editingGeometryRef.current };
            const shownNow = { ...element, ...geometry };
            if (shownNow.height !== shownBefore.height || shownNow.endY !== shownBefore.endY) {
                editingGeometryRef.current = geometry;
                spatialIndexRef.current.update(editingElementId, shownNow);
                repaintElement(shownBefore);
                repaintElement(shownNow);
            }
            return fitted;
        },
        [elements, editingElementId, editingGeometryRef, spatialIndexRef, repaintElement],
    );

    const handleTextEditorChange = useCallback(
        (newText, shownText) => {
            const table = elements[editingElementId];
            if (table?.type === "table" && editingCell) {
                setEditingDraft((prev) => {
                    if (!prev) return prev;
                    const index = cellIndex({ ...table, ...prev }, editingCell.row, editingCell.col);
                    const cells = prev.cells.map((text, i) => (i === index ? newText : text));
                    return { ...prev, cells, endY: showTableDraft(editingElementId, { ...table, ...prev, cells }, editingCell).endY };
                });
                return;
            }
            const merged = textCollabSessionRef.current?.applyLocalChange(shownText ?? newText, newText) ?? newText;
            setEditingDraft((prev) => (prev ? fitDraft({ ...prev, text: merged }) : prev));
            scheduleTextEditFlush();
        },
        [elements, editingElementId, editingCell, showTableDraft, scheduleTextEditFlush, fitDraft, setEditingDraft, textCollabSessionRef],
    );

    const handleTextEditorFormatChange = useCallback(
        (patch) => {
            setEditingDraft((prev) => (prev ? fitDraft({ ...prev, ...patch }) : prev));
        },
        [fitDraft, setEditingDraft],
    );

    // Moves typing to another cell of the table under edit. Stepping past the last
    // cell adds a row, the way Tab does in a document's table.
    const editTableCell = useCallback(
        (target) => {
            const table = elements[editingElementId];
            if (table?.type !== "table" || !editingDraft) return;
            let draft = { ...table, ...editingDraft };
            let next = target;
            let grown = null;
            if (typeof target === "number") {
                const index = cellIndex(draft, editingCell.row, editingCell.col) + target;
                if (index < 0) return;
                if (index >= draft.rows * draft.cols) {
                    grown = insertRow(draft, draft.rows);
                    if (!grown) return;
                    draft = { ...draft, ...grown };
                }
                next = { row: Math.floor(index / draft.cols), col: index % draft.cols };
            }
            setEditingCell(next);
            const fitted = showTableDraft(editingElementId, draft, next);
            setEditingDraft((prev) => ({ ...prev, ...grown, endY: fitted.endY }));
        },
        [elements, editingElementId, editingDraft, editingCell, setEditingDraft, showTableDraft],
    );

    const closeTextEditor = useCallback(() => {
        if (textEditFlushTimerRef.current) {
            clearTimeout(textEditFlushTimerRef.current);
            textEditFlushTimerRef.current = null;
        }
        textCollabSessionRef.current?.destroy();
        textCollabSessionRef.current = null;
        editingTextIdRef.current = null;
        const elementId = editingElementId;
        const element = elementId && elements[elementId];
        if (element) repaintElement(element);
        // Typing may have grown the outline; it goes back to its stored size until the edit is applied.
        if (element && editingGeometryRef.current) {
            repaintElement({ ...element, ...editingGeometryRef.current });
            spatialIndexRef.current.update(elementId, element);
        }
        editingGeometryRef.current = null;
        const isNew = newTextIdRef.current === elementId;
        newTextIdRef.current = null;
        setEditingCell(null);
        setEditingElementId(null);
        setEditingDraft(null);
        if (!element || !editingDraft) {
            requestStaticFullRepaint(elements);
            return;
        }
        const merged = { ...element, ...editingDraft };
        const isEmptyText = merged.type === "text" && !merged.text.trim();
        if (isEmptyText && isNew) {
            const { [elementId]: abandoned, ...remaining } = elements;
            void abandoned;
            setElements(remaining);
            requestStaticFullRepaint(remaining);
        } else if (isEmptyText) {
            removeElement(elementId);
        } else if (isNew) {
            addElement(elementId, merged);
            setSelectedElementIds([elementId]);
        } else {
            applyElementUpdates({ [elementId]: merged });
        }
    }, [
        editingElementId,
        editingDraft,
        elements,
        applyElementUpdates,
        requestStaticFullRepaint,
        addElement,
        removeElement,
        setElements,
        setSelectedElementIds,
        repaintElement,
        editingGeometryRef,
        editingTextIdRef,
        spatialIndexRef,
        setEditingDraft,
        setEditingElementId,
        textCollabSessionRef,
        textEditFlushTimerRef,
    ]);

    return {
        closeTextEditor,
        editTableCell,
        editingCell,
        handleTextEditorChange,
        handleTextEditorFormatChange,
        openTextEditor,
    };
};
