import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { DEFAULT_TABLE_SIZE } from "../../../../../shared/canvas/elements/table.js";
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { GLYPHS } from "../../../../../shared/canvas/diagramStyles/glyphs.js";
import { boundsOf, DEFAULT_GAP_BY_AXIS, elementIdsForRefs, gapFor, generateEditElementId, nextZIndex, placementDelta } from "./common.js";

const ADD_SHAPE_TYPES = { rectangle: "Rectangle", ellipse: "Ellipse", diamond: "Diamond" };
const ADD_SIZES = { sticky: { width: 200, height: 200 }, shape: { width: 180, height: 90 }, icon: { width: 96, height: 96 } };
const TEXT_SIZES = { small: 12, medium: 16, large: 28, huge: 48 };
const CHAR_WIDTH = 0.6;
const ADD_INK = "#1f2937";
const DEFAULT_STICKY_FILL = "#fef3c7";
const TABLE_CELL_CHAR_WIDTH = 8;
const TABLE_COL_WIDTH = { min: 100, max: 260 };
const FRAME_PADDING = 40;
const FRAME_INK = "#94a3b8";
const common = { rotation: 0, opacity: 100 };

// Beside the anchor when there is one, otherwise right of everything so nothing is covered.
const addPosition = (elements, groupIndex, op, { width, height }) => {
    const box = { minX: 0, minY: 0, maxX: width, maxY: height };
    const anchorBounds = op.anchorRef ? boundsOf(elements, groupIndex, op.anchorRef) : null;
    if (anchorBounds) {
        const relation = op.relation ?? "right-of";
        const { dx, dy } = placementDelta(box, anchorBounds, relation, gapFor(relation));
        return { x: dx, y: dy };
    }
    const boardBounds = getUnionBounds(Object.values(elements));
    if (!boardBounds) return { x: -width / 2, y: -height / 2 };
    return { x: boardBounds.maxX + DEFAULT_GAP_BY_AXIS.horizontal, y: (boardBounds.minY + boardBounds.maxY) / 2 - height / 2 };
};

// An explicit colour is the ink's own; otherwise the theme's primary ink, which follows dark mode.
const inkFields = (color) => (color ? { color, colorToken: null } : { color: "#000000", colorToken: "ink-primary" });

const addText = (elements, groupIndex, op) => {
    const size = TEXT_SIZES[op.textSize ?? "medium"];
    const longestLine = Math.max(...op.text.split("\n").map((line) => line.length), 1);
    const width = Math.min(900, Math.max(220, longestLine * size * CHAR_WIDTH));
    const { x, y } = addPosition(elements, groupIndex, op, { width, height: size * 1.4 });
    return { type: "text", x, y, width, text: op.text, ...inkFields(op.color), size, zIndex: nextZIndex(elements), ...common };
};

const addSticky = (elements, groupIndex, op) => {
    const { x, y } = addPosition(elements, groupIndex, op, ADD_SIZES.sticky);
    return {
        type: "sticky",
        x,
        y,
        ...ADD_SIZES.sticky,
        text: op.text,
        color: op.color ?? ADD_INK,
        fillColor: op.fillColor ?? DEFAULT_STICKY_FILL,
        size: TEXT_SIZES[op.textSize ?? "medium"],
        zIndex: nextZIndex(elements),
        ...common,
    };
};

// Rows as given, padded to the widest; the first row is the header when there is more than one.
const addTable = (elements, groupIndex, op) => {
    const rows = op.rows ?? [[op.text]];
    const cols = Math.max(...rows.map((row) => row.length));
    const cells = rows.flatMap((row) => Array.from({ length: cols }, (_, col) => row[col] ?? ""));
    const longest = Math.max(...cells.map((cell) => cell.length), 1);
    const colWidth = Math.min(TABLE_COL_WIDTH.max, Math.max(TABLE_COL_WIDTH.min, longest * TABLE_CELL_CHAR_WIDTH + 24));
    const box = { width: cols * colWidth, height: rows.length * DEFAULT_TABLE_SIZE.rowHeight };
    const { x, y } = addPosition(elements, groupIndex, op, box);
    return {
        type: "table",
        startX: x,
        startY: y,
        endX: x + box.width,
        endY: y + box.height,
        rows: rows.length,
        cols,
        cells,
        headerRow: rows.length > 1,
        ...inkFields(op.color),
        fillColor: op.fillColor ?? null,
        size: 14,
        fontFamily: FONT_FAMILIES[0],
        align: "left",
        zIndex: nextZIndex(elements),
        ...common,
    };
};

const addIcon = (elements, groupIndex, op) => {
    const icon = GLYPHS[op.text.trim().toLowerCase()];
    if (!icon) return null;
    const { x, y } = addPosition(elements, groupIndex, op, ADD_SIZES.icon);
    return {
        type: "shape",
        shapeType: "Icon",
        startX: x,
        startY: y,
        endX: x + ADD_SIZES.icon.width,
        endY: y + ADD_SIZES.icon.height,
        icon,
        ...inkFields(op.color),
        fillColor: null,
        size: 0,
        zIndex: nextZIndex(elements),
        ...common,
    };
};

const addShape = (elements, groupIndex, op) => {
    const { width, height } = ADD_SIZES.shape;
    const { x, y } = addPosition(elements, groupIndex, op, ADD_SIZES.shape);
    const zIndex = nextZIndex(elements);
    const shape = {
        type: "shape",
        shapeType: ADD_SHAPE_TYPES[op.kind],
        startX: x,
        startY: y,
        endX: x + width,
        endY: y + height,
        ...inkFields(op.color),
        fillColor: op.fillColor ?? null,
        size: 2,
        zIndex,
        ...common,
    };
    if (!op.text) return [shape];
    const label = {
        type: "text",
        x: x + 12,
        y: y + height / 2 - 11,
        width: width - 24,
        text: op.text,
        align: "center",
        ...(op.color ? inkFields(op.color) : op.fillColor ? { color: ADD_INK, colorToken: null } : inkFields(null)),
        size: TEXT_SIZES[op.textSize ?? "small"] + 2,
        zIndex: zIndex + 1,
        ...common,
    };
    return [shape, label];
};

const executeAdd = (elements, groupIndex, op) => {
    if (op.kind === "icon") {
        const icon = addIcon(elements, groupIndex, op);
        return icon
            ? { newElementsById: { [generateEditElementId()]: icon } }
            : { error: `no icon named "${op.text}"; choose from ${Object.keys(GLYPHS).join(", ")}` };
    }
    const added =
        op.kind === "text"
            ? [addText(elements, groupIndex, op)]
            : op.kind === "sticky"
              ? [addSticky(elements, groupIndex, op)]
              : op.kind === "table"
                ? [addTable(elements, groupIndex, op)]
                : addShape(elements, groupIndex, op);
    return { newElementsById: Object.fromEntries(added.map((element) => [generateEditElementId(), element])) };
};

// A named frame drawn around the refs, behind them, holding them as its children.
const executeFrame = (elements, groupIndex, op) => {
    const memberIds = elementIdsForRefs(groupIndex, op.refs).filter((id) => elements[id]);
    const bounds = getUnionBounds(memberIds.map((id) => elements[id]));
    if (!bounds) return { error: "frame needs at least one object to go around" };
    const frameId = generateEditElementId();
    const zIndex = Math.min(...memberIds.map((id) => elements[id].zIndex ?? 0)) - 1;
    const frame = {
        type: "frame",
        startX: bounds.minX - FRAME_PADDING,
        startY: bounds.minY - FRAME_PADDING,
        endX: bounds.maxX + FRAME_PADDING,
        endY: bounds.maxY + FRAME_PADDING,
        name: op.name,
        color: FRAME_INK,
        fillColor: null,
        zIndex,
        rotation: 0,
        groupId: null,
        frameId: null,
        locked: false,
    };
    return {
        newElementsById: { [frameId]: frame },
        updatedById: Object.fromEntries(memberIds.map((id) => [id, { ...elements[id], frameId }])),
    };
};

export const ADDITION_EXECUTORS = { add: executeAdd, frame: executeFrame };
