import { COLORS } from "../tools/toolSettings";
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { worldPointToElement } from "../../../../../shared/canvas/geometry/elementGeometry.js";
import { DEFAULT_TABLE_SIZE, emptyCells, TABLE_CELL_PADDING } from "../../../../../shared/canvas/elements/table.js";
import { baseStyleOf, layoutRichText } from "./richTextLayout";
import { measureContext } from "./textFit";
import { LINE_HEIGHT_RATIO } from "../../../../../shared/canvas/geometry/bounds.js";

export const DEFAULT_TABLE_FONT_SIZE = 14;

const layoutCache = new WeakMap();

// Columns share the width evenly; each row is as tall as its tallest cell, and
// a table stretched taller than its words shares the spare height between rows.
export const tableLayout = (table) => {
    const cached = layoutCache.get(table);
    if (cached) return cached;
    const left = Math.min(table.startX, table.endX);
    const top = Math.min(table.startY, table.endY);
    const colWidth = Math.abs(table.endX - table.startX) / table.cols;
    const size = table.size || DEFAULT_TABLE_FONT_SIZE;
    const family = table.fontFamily || FONT_FAMILIES[0];
    const lineHeight = size * LINE_HEIGHT_RATIO;
    const context = measureContext();
    const cellLines = (table.cells ?? []).map((text, index) => {
        const isHeader = table.headerRow && index < table.cols;
        const base = baseStyleOf({ ...table, fontWeight: isHeader ? "bold" : table.fontWeight }, size, family);
        return text ? layoutRichText(context, text, Math.max(1, colWidth - TABLE_CELL_PADDING * 2), base) : [];
    });
    const naturalHeights = Array.from({ length: table.rows }, (_, row) => {
        const tallest = Math.max(1, ...cellLines.slice(row * table.cols, (row + 1) * table.cols).map((lines) => lines.length));
        return tallest * lineHeight + TABLE_CELL_PADDING * 2;
    });
    const natural = naturalHeights.reduce((sum, height) => sum + height, 0);
    const spare = Math.max(0, Math.abs(table.endY - table.startY) - natural) / table.rows;
    const rowHeights = naturalHeights.map((height) => height + spare);
    const rowTops = [];
    let rowTop = top;
    rowHeights.forEach((height) => {
        rowTops.push(rowTop);
        rowTop += height;
    });
    const layout = {
        left,
        top,
        colWidth,
        rowTops,
        rowHeights,
        cellLines,
        lineHeight,
        size,
        family,
        natural,
        height: natural + spare * table.rows,
        width: colWidth * table.cols,
    };
    layoutCache.set(table, layout);
    return layout;
};

export const cellBox = (table, row, col) => {
    const layout = tableLayout(table);
    return { x: layout.left + col * layout.colWidth, y: layout.rowTops[row], width: layout.colWidth, height: layout.rowHeights[row] };
};

// The cell under a world point, or null outside the table.
export const cellAt = (table, worldPoint) => {
    const layout = tableLayout(table);
    const { x, y } = worldPointToElement(table, worldPoint);
    const col = Math.floor((x - layout.left) / layout.colWidth);
    const row = layout.rowTops.findLastIndex((rowTop) => y >= rowTop);
    if (col < 0 || col >= table.cols || row < 0 || y > layout.top + layout.height) return null;
    return { row, col };
};

// A new table's own fields at `box`, tall enough for whatever its cells already hold.
export const newTableFields = (box, { rows = DEFAULT_TABLE_SIZE.rows, cols = DEFAULT_TABLE_SIZE.cols, cells = emptyCells(rows, cols) } = {}) => {
    const table = {
        type: "table",
        startX: box.x,
        startY: box.y,
        endX: box.x + box.width,
        endY: box.y + box.height,
        rows,
        cols,
        cells,
        headerRow: true,
        color: COLORS.BLACK,
        colorToken: "ink-primary",
        fillColor: null,
        fillColorToken: "bg-surface",
        size: DEFAULT_TABLE_FONT_SIZE,
        fontFamily: FONT_FAMILIES[0],
        align: "left",
        opacity: 100,
    };
    return { ...table, endY: box.y + Math.max(box.height, tableLayout(table).natural) };
};
