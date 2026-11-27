// Cells live row by row in one flat array, so concurrent edits to different cells
// merge independently as `cells.<index>`.
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLS = 20;
export const MAX_CELL_LENGTH = 1000;
export const TABLE_CELL_PADDING = 8;
export const DEFAULT_TABLE_SIZE = { rows: 3, cols: 3, colWidth: 140, rowHeight: 40 };
export const TABLE_STYLES = ["grid", "striped", "lines", "bold"];

// The bold style fills the header row with the ink colour, so its words take the table's fill.
export const hasInvertedHeader = (table) => Boolean(table.headerRow) && table.tableStyle === "bold";

export const cellIndex = (table, row, col) => row * table.cols + col;
export const cellText = (table, row, col) => table.cells?.[cellIndex(table, row, col)] ?? "";

export const emptyCells = (rows, cols) => Array.from({ length: rows * cols }, () => "");

const rowsOf = (table) => Array.from({ length: table.rows }, (_, row) => table.cells.slice(row * table.cols, (row + 1) * table.cols));

// Every structural change keeps the table's height per row, so a new row is as tall as the others.
const withRows = (table, rows) => {
    const top = Math.min(table.startY, table.endY);
    const rowHeight = Math.abs(table.endY - table.startY) / table.rows;
    return { rows: rows.length, cells: rows.flat(), startY: top, endY: top + rowHeight * rows.length };
};

const withCols = (table, rows, cols) => {
    const left = Math.min(table.startX, table.endX);
    const colWidth = Math.abs(table.endX - table.startX) / table.cols;
    return { cols, cells: rows.flat(), startX: left, endX: left + colWidth * cols };
};

// Each returns the fields to update, or null when the table is already at its limit.
export const insertRow = (table, at) => {
    if (table.rows >= MAX_TABLE_ROWS) return null;
    const rows = rowsOf(table);
    rows.splice(
        at,
        0,
        Array.from({ length: table.cols }, () => ""),
    );
    return withRows(table, rows);
};

export const removeRow = (table, at) => {
    if (table.rows <= 1) return null;
    const rows = rowsOf(table);
    rows.splice(at, 1);
    return withRows(table, rows);
};

export const insertCol = (table, at) => {
    if (table.cols >= MAX_TABLE_COLS) return null;
    const rows = rowsOf(table).map((row) => [...row.slice(0, at), "", ...row.slice(at)]);
    return withCols(table, rows, table.cols + 1);
};

export const removeCol = (table, at) => {
    if (table.cols <= 1) return null;
    const rows = rowsOf(table).map((row) => row.filter((_, col) => col !== at));
    return withCols(table, rows, table.cols - 1);
};

// Spreadsheet cells arrive as tab-separated lines of equal width; tab-indented text does not.
export const tableFromTabbedText = (text) => {
    const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
    const grid = lines.map((line) => line.split("\t"));
    const cols = grid[0].length;
    if (cols < 2 || grid.some((row) => row.length !== cols)) return null;
    if (!grid.some((row) => row.filter((cell) => cell.trim()).length >= 2)) return null;
    const rows = grid
        .slice(0, MAX_TABLE_ROWS)
        .map((row) => Array.from({ length: Math.min(cols, MAX_TABLE_COLS) }, (_, col) => (row[col] ?? "").trim().slice(0, MAX_CELL_LENGTH)));
    return { rows: rows.length, cols: rows[0].length, cells: rows.flat() };
};
