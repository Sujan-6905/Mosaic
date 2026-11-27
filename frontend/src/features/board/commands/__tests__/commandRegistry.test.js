import { describe, it, expect, vi } from "vitest";
import { buildCommandRegistry } from "../commandRegistry.js";
import { MENU_ITEM_SHORTCUTS, MENU_ITEMS } from "../../tools/toolSettings";

describe("buildCommandRegistry", () => {
    it("omits a command whose backing action wasn't provided", () => {
        const commands = buildCommandRegistry({ selectTool: vi.fn() });
        expect(commands.some((c) => c.id === "edit:undo")).toBe(false);
    });

    it("includes a command once its backing action is provided", () => {
        const commands = buildCommandRegistry({ selectTool: vi.fn(), undo: vi.fn() });
        expect(commands.some((c) => c.id === "edit:undo")).toBe(true);
    });

    it("gives every command a unique id", () => {
        const commands = buildCommandRegistry({
            selectTool: vi.fn(),
            undo: vi.fn(),
            redo: vi.fn(),
            duplicate: vi.fn(),
            group: vi.fn(),
            ungroup: vi.fn(),
            toggleLock: vi.fn(),
            tidyUp: vi.fn(),
            zoomIn: vi.fn(),
            zoomOut: vi.fn(),
            zoomReset: vi.fn(),
            zoomToFit: vi.fn(),
            openExport: vi.fn(),
            openImport: vi.fn(),
            openHistory: vi.fn(),
            openReplay: vi.fn(),
            openBranches: vi.fn(),
            openClearBoard: vi.fn(),
            openAiAssistant: vi.fn(),
            goToDashboard: vi.fn(),
            openHelp: vi.fn(),
        });
        expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    });

    it("reads a tool command's shortcut from the same map the tool rail uses", () => {
        const commands = buildCommandRegistry({ selectTool: vi.fn() });
        const selectCommand = commands.find((c) => c.id === `tool:${MENU_ITEMS.SELECT}`);
        expect(selectCommand.shortcut).toBe(MENU_ITEM_SHORTCUTS[MENU_ITEMS.SELECT]);
    });

    it("calling a tool command's run() dispatches the real selectTool action", () => {
        const selectTool = vi.fn();
        const commands = buildCommandRegistry({ selectTool });
        commands.find((c) => c.id === `tool:${MENU_ITEMS.RECTANGLE}`).run();
        expect(selectTool).toHaveBeenCalledWith(MENU_ITEMS.RECTANGLE);
    });

    it("adds one theme command per provided theme", () => {
        const setTheme = vi.fn();
        const commands = buildCommandRegistry({
            selectTool: vi.fn(),
            setTheme,
            themes: [
                { id: "dark", label: "Dark" },
                { id: "light", label: "Light" },
            ],
        });
        const themeCommands = commands.filter((c) => c.category === "Theme");
        expect(themeCommands).toHaveLength(2);
        themeCommands[0].run();
        expect(setTheme).toHaveBeenCalledWith(themeCommands[0].id.replace("theme:", ""));
    });
});
