import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBold,
    faItalic,
    faUnderline,
    faStrikethrough,
    faAlignLeft,
    faAlignCenter,
    faAlignRight,
    faChevronDown,
    faListUl,
    faListOl,
    faLink,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./TextEditorOverlay.module.css";
import IconButton from "@/components/ui/IconButton";
import FontSizeStepper from "../stylePickers/FontSizeStepper";
import FontChoiceList from "../stylePickers/FontChoices";
import { fontLabel } from "../stylePickers/FontChoices/fontChoices";
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { worldToScreen } from "../camera/camera";
import { elementColorStyle } from "../rendering/colorResolver";
import { getElementBounds, boundsCenter, STICKY_TEXT_PADDING } from "../../../../../shared/canvas/geometry/bounds.js";
import { shapeTextLayout, stickyTextLayout } from "./textFit";
import { connectorLabelPoint, resolveConnectorPolyline } from "../../../../../shared/canvas/elements/connectors";
import { shapeTextBox } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import { continueList, insertLink, toggleInlineMark, toggleList } from "../../../../../shared/canvas/elements/richText.js";
import { cellText, hasInvertedHeader, TABLE_CELL_PADDING } from "../../../../../shared/canvas/elements/table.js";
import { cellBox, DEFAULT_TABLE_FONT_SIZE } from "./tableLayout";
import { caretAfterChange } from "./textCollab";

const CONNECTOR_LABEL_WIDTH = 180;
const EMPTY_TEXT_WIDTH = 96;
// In its own panel inside the editor rather than a portal, so choosing a font
// never reads as a click outside the text being edited.
const FontMenu = ({ element, onChange }) => {
    const [open, setOpen] = useState(false);
    const label = fontLabel(element.fontFamily);
    return (
        <div className={styles.fontMenu}>
            <button
                type="button"
                className={styles.fontButton}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label="Font"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span style={{ fontFamily: element.fontFamily || FONT_FAMILIES[0] }}>{label}</span>
                <FontAwesomeIcon icon={faChevronDown} className={styles.fontChevron} />
            </button>
            {open && (
                <div className={styles.fontList}>
                    <FontChoiceList
                        current={element}
                        keepFocus
                        onPick={(font) => {
                            onChange({ fontFamily: font.fontFamily, fontSource: font.source });
                            setOpen(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// Where the editing box sits for each kind of element, in world units, and the
// point it turns about when the element is rotated.
const editorBox = (element, elements, cell) => {
    if (element.type === "table") {
        const box = cellBox(element, cell.row, cell.col);
        const pivot = element.rotation ? boundsCenter(getElementBounds(element)) : null;
        return {
            x: box.x + TABLE_CELL_PADDING,
            y: box.y + TABLE_CELL_PADDING,
            width: box.width - TABLE_CELL_PADDING * 2,
            height: box.height - TABLE_CELL_PADDING * 2,
            pivot,
        };
    }
    if (element.type === "connector") {
        const center = connectorLabelPoint(element, resolveConnectorPolyline(element, elements));
        return { x: center.x - CONNECTOR_LABEL_WIDTH / 2, y: center.y - 14, width: CONNECTOR_LABEL_WIDTH, height: null, pivot: null };
    }
    const pivot = element.rotation ? boundsCenter(getElementBounds(element)) : null;
    if (element.type === "shape") return { ...shapeTextBox(element), pivot };
    if (element.type === "sticky") {
        return {
            x: element.x + STICKY_TEXT_PADDING,
            y: element.y + STICKY_TEXT_PADDING,
            width: element.width - STICKY_TEXT_PADDING * 2,
            height: element.height - STICKY_TEXT_PADDING * 2,
            pivot,
        };
    }
    return { x: element.x, y: element.y, width: element.width, height: null, pivot };
};

// One inline editor for text, sticky notes, the words inside a shape and an
// arrow's label: a textarea tracking the camera, with formatting just above it.
const TextEditorOverlay = ({ element, elements, cell, onCellStep, camera, onTextChange, onFormatChange, onClose }) => {
    const textareaRef = useRef(null);
    const wrapperRef = useRef(null);
    const pendingSelectionRef = useRef(null);
    const caretRef = useRef([0, 0]);
    const isSticky = element.type === "sticky";
    const isTable = element.type === "table";
    const carriesText = element.type === "shape" || element.type === "connector";
    const fontField = carriesText ? "fontSize" : "size";
    const fontSize = (carriesText ? element.fontSize : element.size) || (element.type === "connector" ? 13 : isTable ? DEFAULT_TABLE_FONT_SIZE : 16);
    const text = isTable ? cellText(element, cell.row, cell.col) : (element.text ?? "");
    const shownTextRef = useRef(text);
    const isHeaderCell = isTable && element.headerRow && cell.row === 0;
    const onInvertedHeader = isHeaderCell && hasInvertedHeader(element);
    const shownFontSize = isSticky ? stickyTextLayout(element).fontSize : element.type === "shape" ? shapeTextLayout(element).fontSize : fontSize;
    const autoWidth = element.type === "text" && element.autoWidth;

    useEffect(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
        // Only on mount: refocusing on a remote edit would steal focus.
    }, []);

    useEffect(() => {
        const handleOutsidePointerDown = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) onClose();
        };
        document.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [onClose]);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        const before = shownTextRef.current;
        shownTextRef.current = text;
        if (pendingSelectionRef.current) {
            textarea?.setSelectionRange(...pendingSelectionRef.current);
            pendingSelectionRef.current = null;
            return;
        }
        // Someone else's typing changed the text: the caret stays where it was among this person's words.
        if (before !== text && textarea && document.activeElement === textarea) {
            const [start, end] = caretRef.current;
            textarea.setSelectionRange(caretAfterChange(before, text, start), caretAfterChange(before, text, end));
        }
    }, [text]);

    // Grows with its content instead of scrolling inside itself.
    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [text, shownFontSize, element.width, element.fontFamily, camera.zoom]);

    const box = editorBox(element, elements, cell);
    const screen = worldToScreen(camera, box.x, box.y);
    const width = box.width * camera.zoom;
    const height = box.height ? box.height * camera.zoom : undefined;
    const pivot = box.pivot ? worldToScreen(camera, box.pivot.x, box.pivot.y) : null;

    // Rewrites the text and puts the selection back once React has rendered it.
    const editText = (result) => {
        if (!result) return false;
        pendingSelectionRef.current = [result.start ?? result.caret, result.end ?? result.caret];
        onTextChange(result.text, text);
        return true;
    };
    const selection = () => [textareaRef.current.selectionStart, textareaRef.current.selectionEnd];

    // With words selected the mark goes on those words; with none, on the whole box.
    const formatWords = (kind, toggleWhole) => {
        const [start, end] = selection();
        if (!editText(toggleInlineMark(text, start, end, kind))) toggleWhole?.();
    };
    const listWords = (kind) => editText(toggleList(text, ...selection(), kind));
    const linkWords = () => editText(insertLink(text, ...selection()));

    const toggleBold = () => formatWords("bold", () => onFormatChange({ fontWeight: element.fontWeight === "bold" ? "normal" : "bold" }));
    const toggleItalic = () => formatWords("italic", () => onFormatChange({ fontStyle: element.fontStyle === "italic" ? "normal" : "italic" }));
    // A table has no whole-box underline or strike, only on selected words.
    const toggleUnderline = () => formatWords("underline", isTable ? null : () => toggle("underline"));
    const toggleStrike = () => formatWords("strike", isTable ? null : () => toggle("strikethrough"));

    const SHORTCUTS = { b: toggleBold, i: toggleItalic, u: toggleUnderline, k: linkWords };

    const handleKeyDown = (e) => {
        e.stopPropagation();
        const commit = e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey)) || (e.key === "Enter" && element.type === "connector");
        if (commit) {
            e.preventDefault();
            onClose();
            return;
        }
        if (element.type === "connector") return;
        const modifier = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (modifier && !e.altKey && !e.shiftKey && SHORTCUTS[key]) {
            e.preventDefault();
            SHORTCUTS[key]();
        } else if (modifier && e.shiftKey && key === "x") {
            e.preventDefault();
            toggleStrike();
        } else if (e.key === "Enter" && !modifier && !e.shiftKey && !e.altKey) {
            const [start, end] = selection();
            if (start === end && editText(continueList(text, start))) e.preventDefault();
        } else if (isTable && e.key === "Tab" && !modifier && !e.altKey) {
            e.preventDefault();
            onCellStep(e.shiftKey ? -1 : 1);
        }
    };

    const handleTextareaBlur = (e) => {
        if (wrapperRef.current && e.relatedTarget && wrapperRef.current.contains(e.relatedTarget)) return;
        onClose();
    };

    const toggle = (field) => onFormatChange({ [field]: !element[field] });
    const press = (action) => (e) => {
        e.preventDefault();
        action();
    };
    const align = element.align || (carriesText ? "center" : "left");

    return (
        <div
            ref={wrapperRef}
            className={styles.wrapper}
            data-board-chrome
            style={{ left: screen.x, top: screen.y, width: autoWidth ? undefined : width, minHeight: height }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {element.type !== "connector" && (
                <div className={styles.toolbar}>
                    <IconButton
                        size="sm"
                        active={element.fontWeight === "bold"}
                        aria-label="Bold"
                        title="Bold (Ctrl+B), the selected words or the whole box"
                        onMouseDown={press(toggleBold)}
                    >
                        <FontAwesomeIcon icon={faBold} />
                    </IconButton>
                    <IconButton size="sm" active={element.fontStyle === "italic"} aria-label="Italic" title="Italic (Ctrl+I)" onMouseDown={press(toggleItalic)}>
                        <FontAwesomeIcon icon={faItalic} />
                    </IconButton>
                    {!carriesText && (
                        <>
                            <IconButton
                                size="sm"
                                active={!!element.underline}
                                aria-label="Underline"
                                title="Underline (Ctrl+U)"
                                onMouseDown={press(toggleUnderline)}
                            >
                                <FontAwesomeIcon icon={faUnderline} />
                            </IconButton>
                            <IconButton
                                size="sm"
                                active={!!element.strikethrough}
                                aria-label="Strikethrough"
                                title="Strikethrough (Ctrl+Shift+X)"
                                onMouseDown={press(toggleStrike)}
                            >
                                <FontAwesomeIcon icon={faStrikethrough} />
                            </IconButton>
                        </>
                    )}
                    <div className={styles.divider} />
                    <IconButton size="sm" aria-label="Bulleted list" title="Bulleted list" onMouseDown={press(() => listWords("bullet"))}>
                        <FontAwesomeIcon icon={faListUl} />
                    </IconButton>
                    <IconButton size="sm" aria-label="Numbered list" title="Numbered list" onMouseDown={press(() => listWords("number"))}>
                        <FontAwesomeIcon icon={faListOl} />
                    </IconButton>
                    <IconButton
                        size="sm"
                        aria-label="Link"
                        title="Link the selected words (Ctrl+K). Ctrl+click a link on the board to open it."
                        onMouseDown={press(linkWords)}
                    >
                        <FontAwesomeIcon icon={faLink} />
                    </IconButton>
                    <div className={styles.divider} />
                    {["left", "center", "right"].map((option) => (
                        <IconButton
                            key={option}
                            size="sm"
                            active={align === option}
                            aria-label={`Align ${option}`}
                            title={`Align ${option}`}
                            onMouseDown={press(() => onFormatChange({ align: option }))}
                        >
                            <FontAwesomeIcon icon={option === "left" ? faAlignLeft : option === "center" ? faAlignCenter : faAlignRight} />
                        </IconButton>
                    ))}
                    <div className={styles.divider} />
                    <FontMenu element={element} onChange={onFormatChange} />
                    <FontSizeStepper size="sm" value={fontSize} onChange={(size) => onFormatChange({ [fontField]: size })} />
                </div>
            )}
            <textarea
                ref={textareaRef}
                className={styles.textarea}
                data-auto-width={autoWidth || undefined}
                data-kind={element.type}
                aria-label={element.type === "connector" ? "Arrow label" : isTable ? `Row ${cell.row + 1}, column ${cell.col + 1}` : "Text"}
                rows={1}
                placeholder={element.type === "text" ? "Type here" : carriesText ? "Add text" : undefined}
                style={{
                    fontFamily: element.fontFamily || FONT_FAMILIES[0],
                    fontSize: shownFontSize * camera.zoom,
                    fontWeight: isHeaderCell ? "bold" : element.fontWeight || "normal",
                    fontStyle: element.fontStyle || "normal",
                    textDecoration: [element.underline && "underline", element.strikethrough && "line-through"].filter(Boolean).join(" "),
                    textAlign: align,
                    color: onInvertedHeader
                        ? elementColorStyle(element.fillColorToken, element.fillColor)
                        : elementColorStyle(element.colorToken, element.color),
                    width: autoWidth ? Math.max(element.width, element.text ? 12 : EMPTY_TEXT_WIDTH) * camera.zoom + 12 : "100%",
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                    transformOrigin: pivot ? `${pivot.x - screen.x}px ${pivot.y - screen.y}px` : undefined,
                    minHeight: isSticky ? height : undefined,
                }}
                value={text}
                onChange={(e) => {
                    const shown = shownTextRef.current;
                    shownTextRef.current = e.target.value;
                    caretRef.current = [e.target.selectionStart, e.target.selectionEnd];
                    onTextChange(e.target.value, shown);
                }}
                onSelect={(e) => {
                    caretRef.current = [e.target.selectionStart, e.target.selectionEnd];
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleTextareaBlur}
            />
        </div>
    );
};

export default TextEditorOverlay;
