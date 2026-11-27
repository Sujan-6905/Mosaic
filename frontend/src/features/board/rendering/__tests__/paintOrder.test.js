import { describe, it, expect } from "vitest";
import { createPaintOrder } from "../paintOrder.js";

const board = { a: { zIndex: 3 }, b: { zIndex: 1 }, c: { zIndex: 2 }, d: {} };

describe("createPaintOrder", () => {
    it("orders every element low to high, treating a missing zIndex as 0", () => {
        expect(
            createPaintOrder()
                .allEntries(board)
                .map(([id]) => id),
        ).toEqual(["d", "b", "c", "a"]);
    });

    it("keeps the sort until the snapshot changes", () => {
        const order = createPaintOrder();
        const first = order.allEntries(board);
        expect(order.allEntries(board)).toBe(first);
        expect(order.allEntries({ ...board })).not.toBe(first);
    });

    it("gives the same visible order whether it sorts or filters", () => {
        const order = createPaintOrder();
        const filtered = order.visibleEntries(board, ["a", "c"], 4);
        const sorted = order.visibleEntries(board, ["a", "c"], 1000);
        expect(filtered.map(([id]) => id)).toEqual(["c", "a"]);
        expect(sorted).toEqual(filtered);
    });

    it("skips an id the snapshot no longer has", () => {
        expect(
            createPaintOrder()
                .entriesFor(board, ["a", "gone"])
                .map(([id]) => id),
        ).toEqual(["a"]);
    });
});
