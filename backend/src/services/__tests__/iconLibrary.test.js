import { describe, expect, it } from "vitest";
import { ICON_SETS, iconFor, searchIcons } from "../iconLibrary.js";
import { isValidIcon } from "../../../../shared/canvas/elements/iconPaths.js";

describe("the icon library", () => {
    it("offers only sets under licences that allow it, marking logos as trademarks", () => {
        ICON_SETS.forEach((set) => expect(["ISC", "MIT", "Apache-2.0", "CC0-1.0"]).toContain(set.license));
        ICON_SETS.filter((set) => set.kind === "logos").forEach((set) => expect(set.trademarks).toBe(true));
    });

    it("finds icons by every word of a query, exact names first", () => {
        const { icons } = searchIcons({ query: "database", limit: 10 });
        expect(icons[0].name).toBe("database");
        icons.forEach((icon) => expect(icon.name).toContain("database"));
    });

    it("searches only the sets asked for", () => {
        const { icons } = searchIcons({ query: "kubernetes", sets: ["logos"] });
        expect(icons.length).toBeGreaterThan(0);
        icons.forEach((icon) => expect(icon.set).toBe("logos"));
    });

    it("hands out icons as path data a board accepts", () => {
        const icon = iconFor("lucide", "server");
        expect(isValidIcon(icon)).toBe(true);
        expect(iconFor("lucide", "no-such-icon")).toBeNull();
        expect(iconFor("not-a-set", "server")).toBeNull();
    });
});
