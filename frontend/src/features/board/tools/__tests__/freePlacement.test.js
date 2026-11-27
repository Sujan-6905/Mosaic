import { describe, it, expect } from "vitest";
import { findFreeCenter } from "../freePlacement.js";

const box = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
const around = (x, y, w, h) => box(x - w / 2, y - h / 2, x + w / 2, y + h / 2);

describe("findFreeCenter", () => {
    it("keeps the preferred center on an empty board", () => {
        expect(findFreeCenter({ width: 300, height: 200, preferredX: 10, preferredY: 20, occupied: [] })).toEqual({ x: 10, y: 20 });
    });

    it("keeps the preferred center when nothing is in the way", () => {
        const occupied = [box(2000, 2000, 2200, 2200)];
        expect(findFreeCenter({ width: 300, height: 200, preferredX: 0, preferredY: 0, occupied })).toEqual({ x: 0, y: 0 });
    });

    it("moves off existing content so the result no longer overlaps it", () => {
        const occupied = [box(-200, -150, 200, 150)];
        const spot = findFreeCenter({ width: 300, height: 200, preferredX: 0, preferredY: 0, occupied });
        expect(overlaps(around(spot.x, spot.y, 300, 200), occupied[0])).toBe(false);
    });

    it("clears several scattered obstacles at once", () => {
        const occupied = [box(-400, -300, -100, 300), box(100, -300, 400, 300), box(-400, -300, 400, -100)];
        const spot = findFreeCenter({ width: 200, height: 150, preferredX: 0, preferredY: 0, occupied });
        occupied.forEach((o) => expect(overlaps(around(spot.x, spot.y, 200, 150), o)).toBe(false));
    });
});
