// What the mouse and keyboard do together, listed in Help beside the shortcuts.
export const BOARD_GESTURES = [
    {
        category: "Move around the board",
        items: [
            { label: "Pan", keys: ["Space", "Drag"] },
            { label: "Pan", keys: ["Ctrl", "Drag"] },
            { label: "Pan", keys: ["Right drag"] },
            { label: "Pan", keys: ["Middle drag"] },
            { label: "Zoom at the pointer", keys: ["Mouse wheel"] },
            { label: "Zoom at the pointer", keys: ["Ctrl", "Scroll"] },
            { label: "Pan on a trackpad", keys: ["Two fingers"] },
            { label: "Pan sideways", keys: ["Shift", "Scroll"] },
            { label: "Page up or down", keys: ["PgUp", "PgDn"] },
            { label: "Page sideways", keys: ["Shift", "PgUp"] },
            { label: "Pan by dragging near the edge", keys: ["Drag to an edge"] },
        ],
    },
    {
        category: "Select",
        items: [
            { label: "Add to or take from the selection", keys: ["Shift", "Click"] },
            { label: "Box select, adding to the selection", keys: ["Shift", "Drag"] },
            { label: "Lasso select from empty board", keys: ["Alt", "Drag"] },
            { label: "Step into a group or nested shapes", keys: ["Double-click"] },
            { label: "Open an element's link", keys: ["Ctrl", "Click"] },
            { label: "Board properties", keys: ["Alt", "/"] },
            { label: "Pieces library", keys: ["Shift", "P"] },
            { label: "Clear the selection, or leave a tool", keys: ["Esc"] },
        ],
    },
    {
        category: "Move and resize",
        items: [
            { label: "Drag out a copy", keys: ["Alt", "Drag"] },
            { label: "Repeat the last copy's step", keys: ["Ctrl", "D"] },
            { label: "Nudge by 1", keys: ["Arrow keys"] },
            { label: "Nudge by 10", keys: ["Shift", "Arrow keys"] },
            { label: "Keep proportions while resizing", keys: ["Shift", "Drag handle"] },
            { label: "Resize from the centre", keys: ["Alt", "Drag handle"] },
            { label: "Move an arrow's label", keys: ["Drag label"] },
            { label: "Flip horizontally", keys: ["Shift", "H"] },
            { label: "Flip vertically", keys: ["Shift", "V"] },
            { label: "Align selection to an edge", keys: ["Ctrl", "Shift", "Arrow keys"] },
        ],
    },
    {
        category: "Draw",
        items: [
            { label: "Keep a shape square", keys: ["Shift", "Drag"] },
            { label: "Grow a shape from its centre", keys: ["Alt", "Drag"] },
            { label: "Make a shape at its default size", keys: ["Click"] },
            { label: "Start typing on empty board", keys: ["Double-click"] },
        ],
    },
    {
        category: "Flowcharts",
        items: [
            { label: "Add a connected shape that way", keys: ["Ctrl", "Arrow keys"] },
            { label: "Go to the connected shape that way", keys: ["Alt", "Arrow keys"] },
            { label: "Change a shape's kind", keys: ["Tab"] },
            { label: "Change it back", keys: ["Shift", "Tab"] },
        ],
    },
    {
        category: "Write",
        items: [
            { label: "Edit the selected element's words", keys: ["Enter"] },
            { label: "New line while typing", keys: ["Enter"] },
            { label: "Finish typing", keys: ["Ctrl", "Enter"] },
            { label: "Finish typing", keys: ["Esc"] },
            { label: "Bigger text", keys: ["Ctrl", "Shift", ">"] },
            { label: "Smaller text", keys: ["Ctrl", "Shift", "<"] },
            { label: "Type in the next note or shape", keys: ["Click it while typing"] },
        ],
    },
];
