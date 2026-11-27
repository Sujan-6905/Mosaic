import StrokeIcon from "@/components/ui/StrokeIcon";
import { LAYOUT_DIRECTIONS } from "../diagrams/layoutEngine";
import { colorTokenFor } from "../rendering/colorResolver";
import { connectorHead } from "../../../../../shared/canvas/elements/connectors";
import { CLOSED_SHAPE_TOOLS, CONNECTOR_TOOLS, MENU_ITEMS, SHAPE_TOOLS, maxSizeForTool } from "../tools/toolSettings";
import { useLayoutEffect, useRef, useState } from "react";
import useCompactBoard from "../chrome/useCompactBoard";
import { isSafeEmbedUrl } from "../../../../../shared/canvas/elements/links.js";
import { canRoundCorners } from "../../../../../shared/canvas/geometry/shapeGeometry.js";
import ArrowControls from "./ArrowControls";
import LinkPopover from "./LinkPopover";
import PhoneSelection from "./PhoneSelection";
import ShapePicker from "./ShapePicker";
import TableControls from "./TableControls";
import { BarButton, ColourPopover, FontSizeControl, MenuPopover } from "./popovers";
import FontPopover from "./FontPopover";
import { StylePopover } from "./StyleControls";
import styles from "./index.module.css";
import controls from "./controls.module.css";

const PEN_TOOLS = [MENU_ITEMS.PENCIL, MENU_ITEMS.PEN, MENU_ITEMS.HIGHLIGHTER];
const BAR_HEIGHT = 48;
// Clears the rotate handle, which sits 28px above the selection.
const SELECTION_GAP = 44;
const HEADER_CLEARANCE = 76;
const VIEWPORT_MARGIN = 12;
const TEXT_ALIGNS = ["left", "center", "right"];

const TOOL_NAMES = {
    [MENU_ITEMS.PENCIL]: "Pencil",
    [MENU_ITEMS.PEN]: "Pen",
    [MENU_ITEMS.HIGHLIGHTER]: "Highlighter",
    [MENU_ITEMS.ERASER]: "Eraser",
    [MENU_ITEMS.TEXT]: "Text",
    [MENU_ITEMS.CONNECTOR]: "Arrow",
    [MENU_ITEMS.BUCKET]: "Fill",
};

// Which colour slots an element or tool exposes: [{ id, label, field, none }].
function colourTargets({ kind, closed }) {
    if (kind === "sticky")
        return [
            { id: "fill", label: "Note", field: "fillColor" },
            { id: "text", label: "Text", field: "color" },
        ];
    if (kind === "text") return [{ id: "text", label: "Text", field: "color" }];
    if (kind === "table")
        return [
            { id: "fill", label: "Table", field: "fillColor" },
            { id: "text", label: "Text and lines", field: "color" },
        ];
    if (kind === "bucket") return [{ id: "fill", label: "Fill", field: "color" }];
    if (kind === "frame")
        return [
            { id: "fill", label: "Fill", field: "fillColor", none: true },
            { id: "border", label: "Border", field: "color" },
        ];
    if (kind === "shape" && closed)
        return [
            { id: "fill", label: "Fill", field: "fillColor", none: true },
            { id: "border", label: "Border", field: "color" },
            { id: "words", label: "Text", field: "textColor" },
        ];
    if (kind === "shape" || kind === "path" || kind === "connector") return [{ id: "stroke", label: "Colour", field: "color" }];
    return [];
}

// With a selection the bar floats above it and edits it; with a drawing tool and nothing selected it sits
// above the dock and edits the tool's defaults.
export default function ContextBar({
    activeMenuItem,
    selectedColor,
    selectedFillColor,
    selectedBrushSize,
    selectedOpacity,
    onColorChange,
    onFillColorChange,
    onBrushSizeChange,
    onOpacityChange,
    selectedElements,
    selectionRect,
    onUpdateSelectedElement,
    onSelectionAction,
    aiEnabled,
    onAskAi,
    canEdit = true,
    canComment,
    onComment,
    onUndo,
    onRedo,
    drawStyle,
    onDrawStyleChange,
    onToolChange,
    toolLocked,
    onToggleToolLock,
}) {
    const isPhone = useCompactBoard();
    const barRef = useRef(null);
    const [barWidth, setBarWidth] = useState(440);
    // How wide it is depends on what's selected, so it's measured to keep it on screen.
    useLayoutEffect(() => {
        const width = barRef.current?.offsetWidth;
        if (width && width !== barWidth) setBarWidth(width);
    }, [barWidth, selectedElements, activeMenuItem]);
    const isEditingSelection = activeMenuItem === MENU_ITEMS.SELECT && selectedElements.length > 0 && selectionRect;
    const isToolMode =
        !isEditingSelection &&
        (PEN_TOOLS.includes(activeMenuItem) ||
            SHAPE_TOOLS.includes(activeMenuItem) ||
            [MENU_ITEMS.TEXT, MENU_ITEMS.CONNECTOR, MENU_ITEMS.ERASER, MENU_ITEMS.BUCKET].includes(activeMenuItem));
    // Every control here changes the board; the dock still offers comments and the assistant.
    if (!canEdit || (!isEditingSelection && !isToolMode)) return null;

    const primary = isEditingSelection ? selectedElements[0] : null;
    const toolKind = () => {
        if (CONNECTOR_TOOLS.includes(activeMenuItem)) return "connector";
        if (SHAPE_TOOLS.includes(activeMenuItem)) return "shape";
        if (activeMenuItem === MENU_ITEMS.TEXT) return "text";
        if (activeMenuItem === MENU_ITEMS.ERASER) return "eraser";
        if (activeMenuItem === MENU_ITEMS.BUCKET) return "bucket";
        return "path";
    };
    const kind = isEditingSelection ? primary.type : toolKind();
    const closed = isEditingSelection ? CLOSED_SHAPE_TOOLS.includes(primary.shapeType) : CLOSED_SHAPE_TOOLS.includes(activeMenuItem);
    const targets = colourTargets({ kind, closed });
    const hasStroke = ["shape", "path", "connector", "eraser"].includes(kind);
    const hasOpacity = ["shape", "path", "connector", "text", "sticky", "image", "table"].includes(kind);
    const isConnector = kind === "connector";
    const isClosedShapeKind = kind === "shape" && closed;
    const canRound = canRoundCorners(isEditingSelection ? primary.shapeType : activeMenuItem);
    const isPath = kind === "path";
    const carriesText = isEditingSelection && (isClosedShapeKind || isConnector) && primary.text;
    const isTextual = kind === "text" || kind === "sticky";
    const hasBoxText = isTextual || kind === "table";

    const values = isEditingSelection
        ? { color: primary.color, fillColor: primary.fillColor, textColor: primary.textColor }
        : { color: selectedColor, fillColor: selectedFillColor };
    const size = isEditingSelection ? primary.size : selectedBrushSize;
    const opacity = isEditingSelection ? (primary.opacity ?? 100) : selectedOpacity;

    const setColour = (field, colour, options) => {
        if (isEditingSelection) {
            const tokenField = { color: "colorToken", fillColor: "fillColorToken", textColor: "textColorToken" }[field];
            onUpdateSelectedElement?.({ [field]: colour, [tokenField]: colour ? (colorTokenFor(colour) ?? null) : null }, options);
        } else if (field === "color") onColorChange(colour);
        else onFillColorChange(colour);
    };
    const setSize = (next, options) => (isEditingSelection ? onUpdateSelectedElement?.({ size: next }, options) : onBrushSizeChange(next));
    const setOpacity = (next, options) => (isEditingSelection ? onUpdateSelectedElement?.({ opacity: next }, options) : onOpacityChange(next));
    const act = (name, arg) => () => onSelectionAction?.(name, arg);
    const styleValues = isEditingSelection ? primary : drawStyle;
    const setStyle = (patch, options) => {
        if (!isEditingSelection) {
            onDrawStyleChange?.(patch);
            // A pattern needs a colour to show at all, so an unfilled shape takes its ink.
            if (patch.fillStyle && patch.fillStyle !== "solid" && values.fillColor == null) onFillColorChange(values.color);
            return;
        }
        const needsFill = patch.fillStyle && patch.fillStyle !== "solid" && values.fillColor == null;
        onUpdateSelectedElement?.(needsFill ? { ...patch, fillColor: values.color, fillColorToken: colorTokenFor(values.color) ?? null } : patch, options);
    };
    const arrowValues = isEditingSelection
        ? { routing: primary.routing || "straight", startHead: connectorHead(primary, "start"), endHead: connectorHead(primary, "end") }
        : drawStyle;

    const count = selectedElements.length;
    const locked = isEditingSelection && selectedElements.every((element) => element.locked);

    if (isEditingSelection && isPhone) {
        return (
            <PhoneSelection
                primary={primary}
                count={count}
                targets={targets}
                values={values}
                isTextual={isTextual}
                hasStroke={hasStroke}
                size={size}
                setColour={setColour}
                setSize={setSize}
                onUpdate={onUpdateSelectedElement}
                act={act}
                locked={locked}
                aiEnabled={aiEnabled}
                onAskAi={onAskAi}
                onUndo={onUndo}
                onRedo={onRedo}
            />
        );
    }

    let position;
    if (isEditingSelection) {
        const centre = (selectionRect.left + selectionRect.right) / 2;
        const above = selectionRect.top - BAR_HEIGHT - SELECTION_GAP;
        const top = above >= HEADER_CLEARANCE ? above : Math.min(selectionRect.bottom + 16, window.innerHeight - BAR_HEIGHT - 96);
        const halfBar = barWidth / 2 + VIEWPORT_MARGIN;
        position = { left: Math.min(Math.max(centre, halfBar), window.innerWidth - halfBar), top: Math.max(top, HEADER_CLEARANCE) };
    }

    return (
        <div
            ref={barRef}
            role="toolbar"
            aria-label={isEditingSelection ? "Selection" : `${TOOL_NAMES[activeMenuItem] || activeMenuItem} options`}
            className={isEditingSelection ? styles.bar : `${styles.bar} ${styles.toolBar}`}
            style={position}
            data-tour="properties-panel"
        >
            {!isEditingSelection && SHAPE_TOOLS.includes(activeMenuItem) && <ShapePicker activeMenuItem={activeMenuItem} onPick={onToolChange} />}
            {!isEditingSelection && PEN_TOOLS.includes(activeMenuItem) && (
                <div className={controls.segments} role="radiogroup" aria-label="Pen type">
                    {PEN_TOOLS.map((pen) => (
                        <button key={pen} type="button" role="radio" aria-checked={activeMenuItem === pen} onClick={() => onToolChange?.(pen)}>
                            {TOOL_NAMES[pen]}
                        </button>
                    ))}
                </div>
            )}
            {!isEditingSelection && !SHAPE_TOOLS.includes(activeMenuItem) && !PEN_TOOLS.includes(activeMenuItem) && (
                <span className={styles.toolName}>{TOOL_NAMES[activeMenuItem] || activeMenuItem}</span>
            )}
            {targets.length > 0 && (
                <ColourPopover
                    key={`${kind}-${closed}`}
                    targets={targets}
                    values={values}
                    opacity={hasOpacity && !hasStroke ? opacity : null}
                    onColour={setColour}
                    onOpacity={setOpacity}
                />
            )}
            {(hasStroke || (isEditingSelection && hasBoxText)) && <span className={styles.rule} aria-hidden="true" />}
            {hasStroke && (
                <StylePopover
                    size={size}
                    max={maxSizeForTool(isEditingSelection ? MENU_ITEMS.PENCIL : activeMenuItem)}
                    style={styleValues}
                    canFill={isClosedShapeKind}
                    canRound={canRound}
                    canSketch={kind === "shape" || isConnector}
                    canPress={isPath}
                    opacity={hasOpacity ? opacity : null}
                    onSize={setSize}
                    onStyle={kind === "shape" || isConnector || isPath ? setStyle : null}
                    onOpacity={setOpacity}
                />
            )}
            {isConnector && activeMenuItem !== MENU_ITEMS.LINE && (
                <>
                    <span className={styles.rule} aria-hidden="true" />
                    <ArrowControls routing={arrowValues.routing} startHead={arrowValues.startHead} endHead={arrowValues.endHead} onChange={setStyle} />
                </>
            )}
            {kind === "bucket" && (
                <div className={controls.segments} role="radiogroup" aria-label="Fill style">
                    {[
                        ["solid", "Solid"],
                        ["hachure", "Hatch"],
                        ["crosshatch", "Cross"],
                        ["dots", "Dots"],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={(drawStyle?.fillStyle || "solid") === value}
                            onClick={() => onDrawStyleChange?.({ fillStyle: value })}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
            {!isEditingSelection && (SHAPE_TOOLS.includes(activeMenuItem) || CONNECTOR_TOOLS.includes(activeMenuItem)) && (
                <>
                    <span className={styles.rule} aria-hidden="true" />
                    <BarButton label={toolLocked ? "Keep this tool: on" : "Keep this tool: off"} pressed={toolLocked} onClick={onToggleToolLock}>
                        <StrokeIcon name="pin" size={15} />
                    </BarButton>
                </>
            )}
            {carriesText && (
                <>
                    <FontPopover element={primary} onUpdate={onUpdateSelectedElement} />
                    <FontSizeControl value={primary.fontSize || 16} onChange={(fontSize) => onUpdateSelectedElement?.({ fontSize })} />
                </>
            )}
            {isEditingSelection && hasBoxText && (
                <>
                    {kind === "table" && <TableControls table={primary} onUpdate={onUpdateSelectedElement} />}
                    <FontPopover element={primary} onUpdate={onUpdateSelectedElement} />
                    <FontSizeControl value={primary.size || 16} onChange={(next) => onUpdateSelectedElement?.({ size: next })} />
                    <BarButton
                        label="Bold"
                        pressed={primary.fontWeight === "bold"}
                        onClick={() => onUpdateSelectedElement?.({ fontWeight: primary.fontWeight === "bold" ? "normal" : "bold" })}
                    >
                        <span className={styles.bold}>B</span>
                    </BarButton>
                    <BarButton
                        label="Italic"
                        pressed={primary.fontStyle === "italic"}
                        onClick={() => onUpdateSelectedElement?.({ fontStyle: primary.fontStyle === "italic" ? "normal" : "italic" })}
                    >
                        <span className={styles.italic}>I</span>
                    </BarButton>
                    <BarButton
                        label={`Text alignment: ${primary.align || "left"}`}
                        onClick={() => {
                            const current = TEXT_ALIGNS.indexOf(primary.align || "left");
                            onUpdateSelectedElement?.({ align: TEXT_ALIGNS[(current + 1) % TEXT_ALIGNS.length] });
                        }}
                    >
                        <StrokeIcon
                            name={primary.align === "center" ? "textAlignCenter" : primary.align === "right" ? "textAlignRight" : "textAlignLeft"}
                            size={15}
                            strokeWidth={2.2}
                        />
                    </BarButton>
                </>
            )}
            {isEditingSelection && (
                <>
                    <span className={styles.rule} aria-hidden="true" />
                    <MenuPopover
                        label="Align and distribute"
                        icon="align"
                        items={[
                            { heading: count < 2 ? "Select two or more to align" : "Align" },
                            { label: "Align left", onSelect: act("alignLeft"), disabled: count < 2 },
                            { label: "Align centre", onSelect: act("alignHCenter"), disabled: count < 2 },
                            { label: "Align right", onSelect: act("alignRight"), disabled: count < 2 },
                            { label: "Align top", onSelect: act("alignTop"), disabled: count < 2 },
                            { label: "Align middle", onSelect: act("alignVCenter"), disabled: count < 2 },
                            { label: "Align bottom", onSelect: act("alignBottom"), disabled: count < 2 },
                            { heading: "Distribute" },
                            { label: "Distribute horizontally", onSelect: act("distributeHorizontal"), disabled: count < 3 },
                            { label: "Distribute vertically", onSelect: act("distributeVertical"), disabled: count < 3 },
                            { heading: "Tidy up" },
                            { label: "Top-down", onSelect: act("tidyUp", LAYOUT_DIRECTIONS.TOP_DOWN), disabled: count < 2 },
                            { label: "Left-right", onSelect: act("tidyUp", LAYOUT_DIRECTIONS.LEFT_RIGHT), disabled: count < 2 },
                            { label: "Radial", onSelect: act("tidyUp", LAYOUT_DIRECTIONS.RADIAL), disabled: count < 2 },
                        ]}
                    />
                    <MenuPopover
                        label="Arrange"
                        icon="arrange"
                        items={[
                            { label: "Bring to front", onSelect: act("bringToFront") },
                            { label: "Bring forward", onSelect: act("bringForward") },
                            { label: "Send backward", onSelect: act("sendBackward") },
                            { label: "Send to back", onSelect: act("sendToBack") },
                            { heading: "Group" },
                            { label: "Group selection", onSelect: act("group"), disabled: count < 2, shortcut: "Ctrl G" },
                            {
                                label: "Ungroup",
                                onSelect: act("ungroup"),
                                disabled: !selectedElements.some((element) => element.groupId),
                                shortcut: "Ctrl Shift G",
                            },
                        ]}
                    />
                    <BarButton label={locked ? "Unlock selection" : "Lock selection"} pressed={locked} onClick={act("toggleLock")}>
                        <StrokeIcon name={locked ? "lock" : "unlock"} size={15} />
                    </BarButton>
                    <LinkPopover key={primary.link || "no-link"} link={primary.link || null} onChange={(link) => onUpdateSelectedElement?.({ link })} />
                    {primary.type === "embed" && isSafeEmbedUrl(primary.url) && (
                        <a
                            className={styles.button}
                            aria-label="Open page in a new tab"
                            title="Open page in a new tab"
                            href={primary.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <StrokeIcon name="openExternal" size={15} />
                        </a>
                    )}
                    <BarButton label="Duplicate selection" onClick={act("duplicate")}>
                        <StrokeIcon name="duplicate" size={15} />
                    </BarButton>
                    {(count >= 2 || primary.diagram) && (
                        <BarButton label="Restyle as another structure or look" wide onClick={act("openRestyle")} className={`${styles.button} ${styles.wide}`}>
                            Restyle
                        </BarButton>
                    )}
                    <MenuPopover
                        label="More options"
                        icon="more"
                        items={[
                            ...(isTextual
                                ? [
                                      {
                                          label: primary.underline ? "Remove underline" : "Underline",
                                          onSelect: () => onUpdateSelectedElement?.({ underline: !primary.underline }),
                                      },
                                      {
                                          label: primary.strikethrough ? "Remove strikethrough" : "Strikethrough",
                                          onSelect: () => onUpdateSelectedElement?.({ strikethrough: !primary.strikethrough }),
                                      },
                                  ]
                                : []),
                            { label: "Copy style", onSelect: act("copyStyle"), shortcut: "Ctrl Alt C" },
                            { label: "Paste style", onSelect: act("pasteStyle"), shortcut: "Ctrl Alt V" },
                            { label: `Delete ${count === 1 ? "element" : `${count} elements`}`, onSelect: act("remove"), danger: true, shortcut: "Del" },
                        ]}
                    />
                    {(aiEnabled || canComment) && <span className={styles.rule} aria-hidden="true" />}
                    {aiEnabled && (
                        <BarButton label="Ask AI about the selection" wide onClick={onAskAi} className={`${styles.button} ${styles.wide} ${styles.ai}`}>
                            <StrokeIcon name="sparkle" size={15} />
                            Ask AI
                        </BarButton>
                    )}
                    {canComment && (
                        <BarButton label="Comment on the board" onClick={onComment}>
                            <StrokeIcon name="comment" size={15} />
                        </BarButton>
                    )}
                </>
            )}
        </div>
    );
}
