import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { useCallback, useEffect, useRef } from "react";
import { buildDuplicatedElements } from "../../../../../shared/canvas/editing/duplication.js";
import { getUnionBounds, boundsCenter } from "../../../../../shared/canvas/geometry/bounds.js";
import { mermaidSourceIn } from "../../../../../shared/canvas/mermaid/buildMermaidElements.js";
import { parseMermaid } from "../diagrams/parseMermaid";
import { DUPLICATE_OFFSET, generateElementId, withSchemaV2Fields } from "../state/boardHelpers";
import { isEmbedFriendly, normalizeLink, sanitizeIncomingElements, toEmbedUrl } from "../../../../../shared/canvas/elements/links.js";
import { DEFAULT_TABLE_SIZE, tableFromTabbedText } from "../../../../../shared/canvas/elements/table.js";
import { newTableFields } from "../text/tableLayout";
import { nextZIndex } from "../../../../../shared/canvas/editing/zOrder.js";

const CLIPBOARD_MARKER = "mosaic-elements:";
const PASTED_TEXT_MAX_WIDTH = 480;
const PASTED_TEXT_SIZE = 18;
const LOOKS_LIKE_LINK = /^(https?:\/\/|www\.)\S+$/i;
const STYLE_FIELDS = [
    "color",
    "colorToken",
    "fillColor",
    "fillColorToken",
    "fillStyle",
    "strokeStyle",
    "size",
    "opacity",
    "cornerRadius",
    "roughness",
    "pressure",
    "steadying",
    "routing",
    "startHead",
    "endHead",
    "arrowStart",
    "arrowEnd",
    "fontFamily",
    "fontSource",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "align",
];

const isEditableTarget = (target) => target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

const parseMarker = (text) => {
    if (!text?.startsWith(CLIPBOARD_MARKER)) return null;
    try {
        const parsed = JSON.parse(text.slice(CLIPBOARD_MARKER.length));
        return Array.isArray(parsed) ? sanitizeIncomingElements(parsed, [window.location.origin]) : null;
    } catch {
        return null;
    }
};

// Copy and paste, through the system clipboard wherever it's allowed, so pasting
// works from other tabs and apps, and elements copy between boards.
export const useBoardClipboard = (board) => {
    const {
        addElement,
        addGeneratedElements,
        applyElementUpdates,
        clipboardRef,
        color,
        elements,
        hasEditAccess,
        insertEmbed,
        insertImageFile,
        lastPointerWorldRef,
        placeMermaid,
        removeElements,
        selectedElementIds,
        setSelectedElementIds,
        showToast,
        unlockedIds,
        viewportCenter,
    } = board;
    const copiedStyleRef = useRef(null);
    const pasteArrivedRef = useRef(false);

    const copySelection = useCallback(() => {
        // Each copy remembers its id so a pasted arrow can join the pasted shapes it held.
        const copied = selectedElementIds.filter((id) => elements[id]).map((id) => ({ ...elements[id], copiedId: id }));
        clipboardRef.current = copied;
        navigator.clipboard?.writeText?.(`${CLIPBOARD_MARKER}${JSON.stringify(copied)}`).catch(() => {});
    }, [selectedElementIds, elements, clipboardRef]);

    const cutSelection = useCallback(() => {
        copySelection();
        removeElements(selectedElementIds);
    }, [copySelection, removeElements, selectedElementIds]);

    const pasteAt = useCallback(() => lastPointerWorldRef.current ?? viewportCenter(), [lastPointerWorldRef, viewportCenter]);

    // Lands the group centred on the pointer, or exactly where it was copied from.
    const pasteElements = useCallback(
        (copied, { inPlace = false } = {}) => {
            if (copied.length === 0) return;
            const sourceMap = {};
            const sourceIds = copied.map(({ copiedId, ...element }, i) => {
                const id = copiedId || `clipboard-${i}`;
                sourceMap[id] = element;
                return id;
            });
            const center = boundsCenter(getUnionBounds(copied) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 });
            const at = pasteAt();
            const offset = inPlace ? { dx: 0, dy: 0 } : lastPointerWorldRef.current ? { dx: at.x - center.x, dy: at.y - center.y } : DUPLICATE_OFFSET;
            const pasted = buildDuplicatedElements(sourceMap, sourceIds, offset, generateElementId, nextZIndex(elements));
            if (pasted.length === 0) return;
            addGeneratedElements(pasted);
            setSelectedElementIds(pasted.map(({ elementId }) => elementId));
        },
        [elements, addGeneratedElements, setSelectedElementIds, pasteAt, lastPointerWorldRef],
    );

    const pasteClipboard = useCallback(() => pasteElements(clipboardRef.current), [pasteElements, clipboardRef]);
    const pasteClipboardInPlace = useCallback(() => pasteElements(clipboardRef.current, { inPlace: true }), [pasteElements, clipboardRef]);

    const pasteAsText = useCallback(
        (text) => {
            const at = pasteAt();
            if (LOOKS_LIKE_LINK.test(text) && isEmbedFriendly(text)) {
                insertEmbed(toEmbedUrl(text), at);
                return;
            }
            const link = LOOKS_LIKE_LINK.test(text) ? normalizeLink(text) : null;
            const elementId = generateElementId();
            addElement(
                elementId,
                withSchemaV2Fields(
                    {
                        type: "text",
                        x: at.x,
                        y: at.y,
                        width: PASTED_TEXT_MAX_WIDTH,
                        text,
                        color,
                        size: PASTED_TEXT_SIZE,
                        fontFamily: FONT_FAMILIES[0],
                        fontWeight: "normal",
                        fontStyle: "normal",
                        underline: false,
                        strikethrough: false,
                        align: "left",
                        opacity: 100,
                        ...(link ? { link } : {}),
                    },
                    elements,
                ),
            );
            setSelectedElementIds([elementId]);
        },
        [pasteAt, insertEmbed, addElement, color, elements, setSelectedElementIds],
    );

    // Cells copied from a spreadsheet arrive as a table at their natural size.
    const pasteTable = useCallback(
        (grid) => {
            const at = pasteAt();
            const { colWidth, rowHeight } = DEFAULT_TABLE_SIZE;
            const elementId = generateElementId();
            addElement(
                elementId,
                withSchemaV2Fields(newTableFields({ x: at.x, y: at.y, width: grid.cols * colWidth, height: grid.rows * rowHeight }, grid), elements),
            );
            setSelectedElementIds([elementId]);
        },
        [pasteAt, addElement, elements, setSelectedElementIds],
    );

    const pasteText = useCallback(
        (rawText) => {
            const grid = tableFromTabbedText(rawText);
            if (grid) {
                pasteTable(grid);
                return;
            }
            const text = rawText.trim();
            if (!text) return;
            const mermaid = mermaidSourceIn(text);
            if (!mermaid) {
                pasteAsText(text);
                return;
            }
            parseMermaid(mermaid).then((parsed) => {
                if (!parsed.error) {
                    placeMermaid(parsed);
                    return;
                }
                pasteAsText(text);
                showToast?.error("Pasted as text", `That looks like Mermaid, but it couldn't be read: ${parsed.error}`);
            });
        },
        [placeMermaid, pasteAsText, pasteTable, showToast],
    );

    const pasteFromClipboardData = useCallback(
        ({ files, text }) => {
            const image = files.find((file) => file.type.startsWith("image/"));
            if (image) {
                insertImageFile(image, pasteAt());
                return true;
            }
            const copied = parseMarker(text);
            if (copied) {
                pasteElements(copied);
                return true;
            }
            if (text?.trim()) {
                pasteText(text);
                return true;
            }
            return false;
        },
        [insertImageFile, pasteAt, pasteElements, pasteText],
    );

    // Called from the right-click menu, where no paste event is coming.
    const pasteFromSystemClipboard = useCallback(async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find((type) => type.startsWith("image/"));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    insertImageFile(new File([blob], "pasted-image", { type: imageType }), pasteAt());
                    return;
                }
            }
            const text = await navigator.clipboard.readText();
            if (!pasteFromClipboardData({ files: [], text })) pasteClipboard();
        } catch {
            if (clipboardRef.current.length > 0) pasteClipboard();
            else showToast?.info("Paste with Ctrl+V", "This browser only lets the keyboard read the clipboard.");
        }
    }, [insertImageFile, pasteAt, pasteFromClipboardData, pasteClipboard, clipboardRef, showToast]);

    // Falls back to the in-page clipboard when the browser delivers no paste event.
    const handlePasteShortcut = useCallback(() => {
        pasteArrivedRef.current = false;
        setTimeout(() => {
            if (!pasteArrivedRef.current) pasteClipboard();
        }, 60);
    }, [pasteClipboard]);

    useEffect(() => {
        const handlePaste = (e) => {
            if (isEditableTarget(e.target)) return;
            pasteArrivedRef.current = true;
            if (!hasEditAccess) return;
            const data = e.clipboardData;
            const handled = pasteFromClipboardData({ files: [...(data?.files ?? [])], text: data?.getData("text/plain") ?? "" });
            if (handled) e.preventDefault();
            else pasteClipboard();
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [hasEditAccess, pasteFromClipboardData, pasteClipboard]);

    const copyStyle = useCallback(() => {
        const source = elements[selectedElementIds[0]];
        if (!source) return;
        copiedStyleRef.current = Object.fromEntries(STYLE_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
    }, [elements, selectedElementIds]);

    const pasteStyle = useCallback(() => {
        const style = copiedStyleRef.current;
        if (!style) return;
        const updates = {};
        unlockedIds(selectedElementIds).forEach((id) => {
            // Only what this kind of element can actually show.
            const element = elements[id];
            const fits = Object.fromEntries(
                Object.entries(style).filter(
                    ([field]) =>
                        element[field] !== undefined ||
                        (element.type === style.type && field in style) ||
                        ["fillStyle", "strokeStyle", "cornerRadius", "roughness"].includes(field),
                ),
            );
            updates[id] = { ...element, ...fits };
        });
        applyElementUpdates(updates);
    }, [unlockedIds, selectedElementIds, elements, applyElementUpdates]);

    return {
        copySelection,
        copyStyle,
        cutSelection,
        handlePasteShortcut,
        pasteClipboard,
        pasteClipboardInPlace,
        pasteFromSystemClipboard,
        pasteStyle,
    };
};
