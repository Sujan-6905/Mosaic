import { describe, expect, it } from "vitest";
import { boardStatistics, formatBytes } from "../boardStatistics";

const box = (extra) => ({ type: "shape", shapeType: "Rectangle", startX: 0, startY: 0, endX: 100, endY: 50, color: "#000000", size: 2, ...extra });

describe("boardStatistics", () => {
    it("counts an empty board without inventing an extent", () => {
        const stats = boardStatistics({});
        expect(stats.total).toBe(0);
        expect(stats.extent).toBeNull();
    });

    it("counts kinds, shape kinds, words, groups and arrows", () => {
        const stats = boardStatistics({
            a: box({ text: "two words", groupId: "g", locked: true }),
            b: box({ shapeType: "Star", startX: 200, endX: 300, endY: 200, groupId: "g", link: "https://example.com" }),
            c: { type: "sticky", x: 0, y: 0, width: 10, height: 10, text: "one", color: "#000000", fillColor: "#FEF08A" },
            d: { type: "connector", startX: 0, startY: 0, endX: 1, endY: 1, startElementId: "a", endElementId: null, color: "#000000" },
            e: { type: "connector", startX: 0, startY: 0, endX: 1, endY: 1, startElementId: null, endElementId: null, color: "#000000" },
        });
        expect(stats.total).toBe(5);
        expect(stats.kinds[0]).toEqual({ label: "Shapes", count: 2 });
        expect(stats.shapeKinds).toEqual(
            expect.arrayContaining([
                { label: "Star", count: 1 },
                { label: "Rectangle", count: 1 },
            ]),
        );
        expect(stats.words).toBe(3);
        expect(stats.groups).toBe(1);
        expect(stats.locked).toBe(1);
        expect(stats.linked).toBe(1);
        expect(stats.attachedArrows).toBe(1);
        expect(stats.looseArrows).toBe(1);
        expect(stats.extent).toEqual({ width: 300, height: 200 });
        expect(stats.topColours[0]).toEqual({ label: "#000000", count: 5 });
    });
});

describe("formatBytes", () => {
    it("picks the sensible unit", () => {
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(2048)).toBe("2.0 KB");
        expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    });
});
