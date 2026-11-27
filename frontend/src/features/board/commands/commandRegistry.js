import { MENU_ITEMS, MENU_ITEM_SHORTCUTS } from "../tools/toolSettings";
import { LAYOUT_DIRECTIONS } from "../diagrams/layoutEngine";

// Shortcuts come from MENU_ITEM_SHORTCUTS, which tooltips and the keyboard handler use too.
const TOOL_IDS = [
    MENU_ITEMS.SELECT,
    MENU_ITEMS.LASSO,
    MENU_ITEMS.HAND,
    MENU_ITEMS.PENCIL,
    MENU_ITEMS.ERASER,
    MENU_ITEMS.BUCKET,
    MENU_ITEMS.RECTANGLE,
    MENU_ITEMS.ELLIPSE,
    MENU_ITEMS.TRIANGLE,
    MENU_ITEMS.DIAMOND,
    MENU_ITEMS.STAR,
    MENU_ITEMS.ARROW,
    MENU_ITEMS.LINE,
    MENU_ITEMS.TEXT,
    MENU_ITEMS.STICKY,
    MENU_ITEMS.IMAGE,
    MENU_ITEMS.FRAME,
    MENU_ITEMS.CONNECTOR,
    MENU_ITEMS.LASER,
    MENU_ITEMS.COMMENT,
];

// Every command calls the same function as its button or shortcut. An action the caller leaves out,
// such as an edit for a viewer, produces no command rather than a disabled one.
export const buildCommandRegistry = (actions) => {
    const commands = [];
    const add = (id, label, category, shortcut, run) => {
        if (!run) return;
        commands.push({ id, label, category, shortcut: shortcut || null, run });
    };

    TOOL_IDS.forEach((tool) => {
        add(`tool:${tool}`, `${tool} tool`, "Tools", MENU_ITEM_SHORTCUTS[tool], () => actions.selectTool?.(tool));
    });

    add("edit:undo", "Undo", "Edit", "Ctrl+Z", actions.undo);
    add("edit:redo", "Redo", "Edit", "Ctrl+Shift+Z", actions.redo);
    add("edit:duplicate", "Duplicate selection", "Edit", "Ctrl+D", actions.duplicate);
    add("edit:group", "Group selection", "Edit", "Ctrl+G", actions.group);
    add("edit:ungroup", "Ungroup selection", "Edit", "Ctrl+Shift+G", actions.ungroup);
    add("edit:toggleLock", "Toggle lock on selection", "Edit", "Ctrl+Shift+L", actions.toggleLock);
    add("edit:tidyUpTopDown", "Tidy up selection (top-down)", "Edit", null, () => actions.tidyUp?.(LAYOUT_DIRECTIONS.TOP_DOWN));
    add("edit:tidyUpLeftRight", "Tidy up selection (left-right)", "Edit", null, () => actions.tidyUp?.(LAYOUT_DIRECTIONS.LEFT_RIGHT));
    add("edit:tidyUpRadial", "Tidy up selection (radial)", "Edit", null, () => actions.tidyUp?.(LAYOUT_DIRECTIONS.RADIAL));

    add("edit:flipHorizontal", "Flip horizontally", "Edit", "Shift+H", actions.flipHorizontal);
    add("edit:flipVertical", "Flip vertically", "Edit", "Shift+V", actions.flipVertical);
    add("edit:pasteInPlace", "Paste in place", "Edit", "Ctrl+Shift+V", actions.pasteInPlace);
    add("edit:copyAsPng", "Copy as PNG", "Edit", "Shift+Alt+C", actions.copyAsPng);
    add("edit:selectLike", "Select all like this", "Edit", null, actions.selectAllLike);

    add("style:increaseSize", "Increase size", "Style", "]", actions.increaseSize);
    add("style:decreaseSize", "Decrease size", "Style", "[", actions.decreaseSize);
    add("style:increaseOpacity", "Increase opacity", "Style", "Shift+]", actions.increaseOpacity);
    add("style:decreaseOpacity", "Decrease opacity", "Style", "Shift+[", actions.decreaseOpacity);

    add("view:zoomIn", "Zoom in", "View", "Ctrl+=", actions.zoomIn);
    add("view:zoomOut", "Zoom out", "View", "Ctrl+-", actions.zoomOut);
    add("view:zoomReset", "Reset zoom to 100%", "View", "Shift+0", actions.zoomReset);
    add("view:zoomToFit", "Zoom to fit", "View", "Shift+1", actions.zoomToFit);
    add("view:zoomToSelection", "Zoom to selection", "View", "Shift+2", actions.zoomToSelection);

    add("board:export", "Export board…", "Board", null, actions.openExport);
    add("board:import", "Import scene file…", "Board", null, actions.openImport);
    add("board:catchUp", "Catch me up", "Board", null, actions.openCatchUp);
    add("board:timer", "Start a timer for everyone", "Board", null, actions.openTimer);
    add("board:vote", "Start a dot vote", "Board", null, actions.openVoting);
    add("board:architecture", "Architecture from GitHub", "Board", null, actions.openArchitecture);
    add("board:history", "Version history", "Board", null, actions.openHistory);
    add("board:replay", "Replay board history", "Board", null, actions.openReplay);
    add("board:branches", "Branches & diff", "Board", null, actions.openBranches);
    add("board:clear", "Clear board…", "Board", null, actions.openClearBoard);

    add("ai:open", "Open AI assistant", "AI", null, actions.openAiAssistant);

    add("nav:dashboard", "Go to dashboard", "Navigate", null, actions.goToDashboard);
    add("nav:help", "Help and resources", "Navigate", null, actions.openHelp);
    add("nav:shortcuts", "Keyboard shortcuts", "Navigate", "?", actions.openShortcuts);
    add("nav:find", "Find on board", "Navigate", "Ctrl+F", actions.openFind);
    add("insert:pieces", "Pieces library", "Insert", "Shift+P", actions.openPieces);
    add("insert:mermaid", "Mermaid diagram to board", "Insert", null, actions.openMermaid);
    add("nav:boardProperties", "Board properties", "Navigate", "Alt+/", actions.openBoardProperties);

    (actions.tourTracks || []).forEach((track) => {
        add(`tour:${track.id}`, `Replay tutorial: ${track.label}`, "Help", null, () => actions.startTour?.(track.id));
    });

    // Each theme can also be drawn on the board: hold G and draw its sky.
    const SKY_FOR_THEME = { light: "Hold G, draw a sun", dark: "Hold G, draw a moon" };
    (actions.themes || []).forEach((theme) => {
        add(`theme:${theme.id}`, `Theme: ${theme.label}`, "Theme", SKY_FOR_THEME[theme.id], () => actions.setTheme?.(theme.id));
    });

    return commands;
};
