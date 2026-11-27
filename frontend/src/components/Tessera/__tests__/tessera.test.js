import { describe, expect, it } from "vitest";
import { tesseraFor } from "../tessera";

describe("a person's tessera", () => {
    it("is the same tile for the same name, whatever its case or spacing", () => {
        expect(tesseraFor("Sujan")).toEqual(tesseraFor("  sujan "));
    });

    it("is mirrored left to right like a stamp", () => {
        const { cells } = tesseraFor("stonemason");
        for (let row = 0; row < 7; row += 1) {
            const line = cells.slice(row * 7, row * 7 + 7);
            expect(line).toEqual([...line].reverse());
        }
    });

    it("tells different names apart", () => {
        expect(tesseraFor("asha").cells).not.toEqual(tesseraFor("ravi").cells);
    });

    it("is blank until there is a name", () => {
        expect(tesseraFor("")).toEqual({ color: null, cells: Array(49).fill(false) });
    });
});
