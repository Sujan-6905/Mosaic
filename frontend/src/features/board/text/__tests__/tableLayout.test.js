import { describe, it, expect } from "vitest";
import { cellAt, cellBox, newTableFields, tableLayout } from "../tableLayout.js";

const table = (cells, height = 80) => ({ ...newTableFields({ x: 0, y: 0, width: 300, height }, { rows: 2, cols: 3, cells }), endY: height });

describe("tableLayout", () => {
    it("shares the width evenly and fits short rows into the table's height", () => {
        const layout = tableLayout(table(["a", "b", "c", "d", "e", "f"], 200));
        expect(layout.colWidth).toBe(100);
        expect(layout.rowHeights[0]).toBeCloseTo(layout.rowHeights[1]);
        expect(layout.height).toBeCloseTo(200);
    });

    it("grows a row to hold its longest cell", () => {
        const long = "a long run of words that needs several lines in a narrow column";
        const layout = tableLayout(table([long, "b", "c", "d", "e", "f"]));
        expect(layout.rowHeights[0]).toBeGreaterThan(layout.rowHeights[1] * 2);
    });

    it("finds the cell under a point and gives each cell's box", () => {
        const grid = table(["a", "b", "c", "d", "e", "f"], 200);
        expect(cellAt(grid, { x: 250, y: 150 })).toEqual({ row: 1, col: 2 });
        expect(cellAt(grid, { x: 350, y: 150 })).toBeNull();
        expect(cellBox(grid, 1, 0)).toMatchObject({ x: 0, y: 100, width: 100 });
    });
});

describe("newTableFields", () => {
    it("starts tall enough for the cells it was given", () => {
        const fields = newTableFields({ x: 0, y: 0, width: 120, height: 10 }, { rows: 1, cols: 1, cells: ["one two three four five six seven"] });
        expect(fields.endY).toBeGreaterThan(10);
    });
});
