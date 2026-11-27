import { insertCol, insertRow, MAX_TABLE_COLS, MAX_TABLE_ROWS, removeCol, removeRow } from "../../../../../shared/canvas/elements/table.js";
import { MenuPopover } from "./popovers";

const STYLE_CHOICES = [
    { style: "grid", label: "Grid" },
    { style: "striped", label: "Striped rows" },
    { style: "lines", label: "Lines only" },
    { style: "bold", label: "Bold header" },
];

// Rows and columns are added and removed at the table's end; inside a cell, Tab past the last one adds a row too.
export default function TableControls({ table, onUpdate }) {
    const apply = (patch) => () => patch && onUpdate?.(patch);
    const current = table.tableStyle ?? "grid";
    return (
        <>
            <MenuPopover
                label="Rows and columns"
                icon="table"
                items={[
                    { heading: `${table.rows} ${table.rows === 1 ? "row" : "rows"}, ${table.cols} ${table.cols === 1 ? "column" : "columns"}` },
                    { label: "Add a row", onSelect: apply(insertRow(table, table.rows)), disabled: table.rows >= MAX_TABLE_ROWS },
                    { label: "Add a column", onSelect: apply(insertCol(table, table.cols)), disabled: table.cols >= MAX_TABLE_COLS },
                    { label: "Remove the last row", onSelect: apply(removeRow(table, table.rows - 1)), disabled: table.rows <= 1 },
                    { label: "Remove the last column", onSelect: apply(removeCol(table, table.cols - 1)), disabled: table.cols <= 1 },
                    {
                        label: table.headerRow ? "Make the first row plain" : "Make the first row a header",
                        onSelect: () => onUpdate?.({ headerRow: !table.headerRow }),
                    },
                ]}
            />
            <MenuPopover
                label="Table style"
                icon="grid"
                items={[
                    { heading: "Table style" },
                    ...STYLE_CHOICES.map(({ style, label }) => ({
                        label,
                        checked: current === style,
                        onSelect: () => onUpdate?.(style === "bold" ? { tableStyle: style, headerRow: true } : { tableStyle: style }),
                    })),
                ]}
            />
        </>
    );
}
