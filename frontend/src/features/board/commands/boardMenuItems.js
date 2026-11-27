import { bringToFront, sendToBack } from "../../../../../shared/canvas/editing/zOrder";

// The rows of the board's right-click menu, for whatever was under the pointer.
export const boardMenuItems = (board, contextMenu) => {
    const {
        applyZOrderCommand,
        copySelection,
        copyStyle,
        cutSelection,
        duplicateSelection,
        elements,
        flipSelection,
        groupSelection,
        handleZoomToFit,
        hasEditAccess,
        pasteClipboardInPlace,
        pasteFromSystemClipboard,
        selectAllLikeSelection,
        setPiecesOpen,
        setPiecesSaving,
        pasteStyle,
        removeElements,
        selectedElementIds,
        setBoardPropertiesOpen,
        setCommandPaletteOpen,
        setEmbedBoardDialog,
        setSelectedElementIds,
        toggleLockSelection,
        ungroupSelection,
    } = board;
    const canEdit = hasEditAccess;
    if (!contextMenu.onElement || selectedElementIds.length === 0) {
        return [
            { label: "Paste", shortcut: "Ctrl V", onSelect: pasteFromSystemClipboard, disabled: !canEdit },
            { label: "Paste in place", shortcut: "Ctrl Shift V", onSelect: pasteClipboardInPlace, disabled: !canEdit },
            { label: "Select all", shortcut: "Ctrl A", onSelect: () => setSelectedElementIds(Object.keys(elements).filter((id) => !elements[id].locked)) },
            null,
            { label: "Zoom to fit", onSelect: handleZoomToFit },
            { label: "Command palette", shortcut: "Ctrl K", onSelect: () => setCommandPaletteOpen(true) },
            null,
            { label: "Board properties", onSelect: () => setBoardPropertiesOpen(true) },
        ];
    }
    const selected = selectedElementIds.map((id) => elements[id]).filter(Boolean);
    const locked = selected.every((element) => element.locked);
    return [
        { label: "Copy", shortcut: "Ctrl C", onSelect: copySelection },
        { label: "Cut", shortcut: "Ctrl X", onSelect: cutSelection, disabled: !canEdit || locked },
        { label: "Paste", shortcut: "Ctrl V", onSelect: pasteFromSystemClipboard, disabled: !canEdit },
        { label: "Duplicate", shortcut: "Ctrl D", onSelect: duplicateSelection, disabled: !canEdit },
        { label: "Select all like this", onSelect: selectAllLikeSelection },
        {
            label: "Save as a piece",
            onSelect: () => {
                setPiecesSaving(true);
                setPiecesOpen(true);
            },
        },
        ...(selected.length === 1 && selected[0].type === "frame"
            ? [{ label: "Embed this frame", onSelect: () => setEmbedBoardDialog({ frameId: selectedElementIds[0] }) }]
            : []),
        null,
        { label: "Copy style", shortcut: "Ctrl Alt C", onSelect: copyStyle },
        { label: "Paste style", shortcut: "Ctrl Alt V", onSelect: pasteStyle, disabled: !canEdit },
        null,
        { label: "Bring to front", shortcut: "Ctrl Shift ]", onSelect: () => applyZOrderCommand(bringToFront), disabled: !canEdit },
        { label: "Send to back", shortcut: "Ctrl Shift [", onSelect: () => applyZOrderCommand(sendToBack), disabled: !canEdit },
        ...(selected.length > 1 ? [{ label: "Group", shortcut: "Ctrl G", onSelect: groupSelection, disabled: !canEdit }] : []),
        ...(selected.some((element) => element.groupId)
            ? [{ label: "Ungroup", shortcut: "Ctrl Shift G", onSelect: ungroupSelection, disabled: !canEdit }]
            : []),
        { label: "Flip horizontally", shortcut: "Shift H", onSelect: () => flipSelection("x"), disabled: !canEdit || locked },
        { label: "Flip vertically", shortcut: "Shift V", onSelect: () => flipSelection("y"), disabled: !canEdit || locked },
        { label: locked ? "Unlock" : "Lock", shortcut: "Ctrl Shift L", onSelect: toggleLockSelection, disabled: !canEdit },
        null,
        { label: "Delete", shortcut: "Del", onSelect: () => removeElements(selectedElementIds), danger: true, disabled: !canEdit || locked },
        null,
        { label: "Board properties", onSelect: () => setBoardPropertiesOpen(true) },
    ];
};
