import { describe, it, expect } from "vitest";
import { changedFields } from "../changedFields.js";

describe("changedFields", () => {
    const confirmed = { type: "shape", startX: 0, color: "#000", points: [{ x: 1, y: 2 }], label: "a", version: 4, updatedBy: "u1" };

    it("names only the fields that differ from the server's copy, ignoring its stamps", () => {
        expect(changedFields(confirmed, { ...confirmed, startX: 40, version: 9 })).toEqual(["startX"]);
    });

    it("compares nested values by content", () => {
        expect(changedFields(confirmed, { ...confirmed, points: [{ x: 1, y: 2 }] })).toEqual([]);
        expect(changedFields(confirmed, { ...confirmed, points: [{ x: 1, y: 3 }] })).toEqual(["points"]);
    });

    it("names a field that was cleared or added", () => {
        const { label, ...withoutLabel } = confirmed;
        expect(changedFields(confirmed, withoutLabel)).toEqual(["label"]);
        expect(changedFields(confirmed, { ...confirmed, fillColor: "#fff" })).toEqual(["fillColor"]);
        expect(label).toBe("a");
    });

    it("names a table's changed cells one by one, and the whole list when its shape changed", () => {
        const table = { type: "table", rows: 1, cols: 3, cells: ["a", "b", "c"] };
        expect(changedFields(table, { ...table, cells: ["a", "B", "c"] })).toEqual(["cells.1"]);
        expect(changedFields(table, { ...table, rows: 2, cells: ["a", "b", "c", "", "", ""] })).toEqual(["rows", "cells"]);
    });
});
