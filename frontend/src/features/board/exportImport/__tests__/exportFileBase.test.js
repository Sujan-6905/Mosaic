import { describe, it, expect } from "vitest";
import { exportFileBase } from "../useBoardExport";

const day = new Date("2026-11-11T09:00:00Z");

describe("exportFileBase", () => {
    it("names an export after its board and the day", () => {
        expect(exportFileBase("Q3 roadmap", day)).toBe("Q3 roadmap 2026-11-11");
    });

    it("drops characters a file system refuses", () => {
        expect(exportFileBase('Plans: v2/v3 "final"?', day)).toBe("Plans v2 v3 final 2026-11-11");
    });

    it("falls back when the board has no usable name", () => {
        expect(exportFileBase("", day)).toBe("Mosaic board 2026-11-11");
        expect(exportFileBase("///", day)).toBe("Mosaic board 2026-11-11");
    });
});
