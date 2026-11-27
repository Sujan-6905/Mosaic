// The board's menus as plain items, shared by the wide top bar's dropdowns and a phone's board sheet.

export const fileItems = ({ canRename, isFavorite, onRename, onToggleStar, actions, onDelete }) => ({
    about: [
        ...(canRename ? [{ key: "rename", label: "Rename", icon: "rename", onSelect: onRename }] : []),
        { key: "star", label: isFavorite ? "Remove from starred" : "Add to starred", icon: "star", onSelect: onToggleStar },
    ],
    file: [
        { key: "copy", label: "Make a copy", icon: "duplicate", onSelect: actions.copyBoard },
        { key: "import", label: "Import a scene file", icon: "upload", onSelect: actions.openImport },
        { key: "export", label: "Export", icon: "export", onSelect: actions.openExport },
    ],
    danger: actions.openClearBoard
        ? [
              { key: "clear", label: "Clear board", icon: "eraser", destructive: true, onSelect: actions.openClearBoard },
              ...(onDelete ? [{ key: "delete", label: "Delete board", icon: "trash", destructive: true, onSelect: onDelete }] : []),
          ]
        : [],
});

export const historyItems = ({ actions, onToggleHistory, onToggleCatchUp, historyOpen, catchUpOpen }) => [
    { key: "history", label: "Version history", icon: "history", active: historyOpen, onSelect: onToggleHistory },
    { key: "replay", label: "Replay", icon: "replay", onSelect: actions.openReplay },
    { key: "branches", label: "Branches and diff", icon: "branch", onSelect: actions.openBranches },
    { key: "catchUp", label: "Catch me up", icon: "bell", active: catchUpOpen, onSelect: onToggleCatchUp },
];

export const shareItems = ({ isOwner, actions, onPeople, onLetter }) => [
    { key: "people", label: "People with access", icon: "people", onSelect: onPeople },
    { key: "embed", label: "Share and embed", icon: "share", onSelect: () => actions.openEmbedBoard() },
    ...(isOwner ? [{ key: "letter", label: "Write a cover letter", icon: "letter", onSelect: onLetter }] : []),
    { key: "agents", label: "Connect an agent", icon: "agent", onSelect: actions.openAgents },
];

export const sessionItems = ({ actions, isPresenting, onTogglePresent, includePresent }) => [
    ...(includePresent
        ? [{ key: "present", label: isPresenting ? "Stop presenting" : "Present", icon: "present", active: isPresenting, onSelect: onTogglePresent }]
        : []),
    ...(actions.openTimer
        ? [
              { key: "timer", label: "Timer", icon: "timer", onSelect: actions.openTimer },
              { key: "vote", label: "Dot vote", icon: "vote", onSelect: actions.openVoting },
          ]
        : []),
];

// A dropdown takes the same items with a rule between groups and no icons.
export const asDropdown = (...groups) =>
    groups
        .filter((group) => group.length > 0)
        .flatMap((group, index) => [...(index > 0 ? [{ divider: true }] : []), ...group.map((item) => ({ ...item, icon: undefined }))]);
