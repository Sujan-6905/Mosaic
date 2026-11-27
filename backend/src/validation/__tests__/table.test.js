import { describe, it, expect } from "vitest";
import { cellText, insertCol, insertRow, removeCol, removeRow, tableFromTabbedText } from "../../../../shared/canvas/elements/table.js";
import { wordsOf } from "../../../../shared/canvas/elements/elementWords.js";
import { elementSchema } from "../socketSchemas.js";

const table = { type: "table", startX: 0, startY: 0, endX: 300, endY: 80, rows: 2, cols: 3, cells: ["a", "b", "c", "d", "e", "f"] };

describe("table structure", () => {
    it("adds a row as tall as the others and keeps every cell in place", () => {
        expect(insertRow(table, 1)).toEqual({ rows: 3, cells: ["a", "b", "c", "", "", "", "d", "e", "f"], startY: 0, endY: 120 });
    });

    it("adds and removes a column, widening and narrowing the table", () => {
        expect(insertCol(table, 1)).toEqual({ cols: 4, cells: ["a", "", "b", "c", "d", "", "e", "f"], startX: 0, endX: 400 });
        expect(removeCol(table, 0)).toEqual({ cols: 2, cells: ["b", "c", "e", "f"], startX: 0, endX: 200 });
    });

    it("never removes the last row or column", () => {
        expect(removeRow({ ...table, rows: 1, cells: ["a", "b", "c"] }, 0)).toBeNull();
        expect(removeCol({ ...table, cols: 1, cells: ["a", "d"] }, 0)).toBeNull();
    });

    it("reads a cell by row and column", () => {
        expect(cellText(table, 1, 2)).toBe("f");
    });
});

describe("tableFromTabbedText", () => {
    it("turns spreadsheet cells into rows and columns", () => {
        expect(tableFromTabbedText("Name\tRole\r\nAda\tEngineer\n")).toEqual({ rows: 2, cols: 2, cells: ["Name", "Role", "Ada", "Engineer"] });
    });

    it("leaves text without tabs, and code indented with tabs, as text", () => {
        expect(tableFromTabbedText("just words")).toBeNull();
        expect(tableFromTabbedText("if (x) {\n\treturn 1;\n}")).toBeNull();
    });
});

describe("table elements", () => {
    it("are searchable by their cells", () => {
        expect(wordsOf({ ...table, cells: ["**Name**", "", "Role", "Ada", "", ""] })).toBe("Name\nRole\nAda");
    });

    it("are refused unless there is one cell per row and column", () => {
        const valid = { ...table, color: "#000", size: 14, zIndex: 1, rotation: 0 };
        expect(elementSchema.safeParse(valid).success).toBe(true);
        expect(elementSchema.safeParse({ ...valid, cells: ["a"] }).success).toBe(false);
    });
});
