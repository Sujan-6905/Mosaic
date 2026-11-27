import { describe, it, expect, vi } from "vitest";
import { asDropdown, fileItems, historyItems, sessionItems, shareItems } from "../boardMenus.js";

const actions = {
    copyBoard: vi.fn(),
    openImport: vi.fn(),
    openExport: vi.fn(),
    openClearBoard: vi.fn(),
    openReplay: vi.fn(),
    openBranches: vi.fn(),
    openEmbedBoard: vi.fn(),
    openAgents: vi.fn(),
    openTimer: vi.fn(),
    openVoting: vi.fn(),
};
const keys = (items) => items.map((item) => item.key);

describe("board menus", () => {
    it("keeps the board menu to the board itself", () => {
        const files = fileItems({ canRename: true, isFavorite: false, onRename: vi.fn(), onToggleStar: vi.fn(), actions, onDelete: vi.fn() });
        expect([...files.about, ...files.file, ...files.danger].map((item) => item.key)).toEqual([
            "rename",
            "star",
            "copy",
            "import",
            "export",
            "clear",
            "delete",
        ]);
    });

    it("leaves out what a role can't do: renaming, clearing, cover letters, a timer", () => {
        const files = fileItems({
            canRename: false,
            isFavorite: true,
            onRename: vi.fn(),
            onToggleStar: vi.fn(),
            actions: { ...actions, openClearBoard: null },
            onDelete: null,
        });
        expect(keys(files.about)).toEqual(["star"]);
        expect(files.danger).toEqual([]);
        expect(keys(shareItems({ isOwner: false, actions, onPeople: vi.fn(), onLetter: vi.fn() }))).toEqual(["people", "embed", "agents"]);
        expect(sessionItems({ actions: { ...actions, openTimer: null }, includePresent: false })).toEqual([]);
    });

    it("gathers history, catching up included, in one menu", () => {
        expect(keys(historyItems({ actions, onToggleHistory: vi.fn(), onToggleCatchUp: vi.fn() }))).toEqual(["history", "replay", "branches", "catchUp"]);
    });

    it("turns groups into one dropdown with a rule between them and no icons", () => {
        const items = asDropdown([{ key: "a", label: "A", icon: "star" }], [], [{ key: "b", label: "B", icon: "trash" }]);
        expect(items).toEqual([{ key: "a", label: "A", icon: undefined }, { divider: true }, { key: "b", label: "B", icon: undefined }]);
    });
});
