// The levers a look is a preset of. A person or the assistant can change any of
// them on a selection, and the result saved back is a custom look.

export const LEVERS = [
    {
        id: "shape",
        number: 1,
        name: "Shape language",
        options: ["box", "rounded", "pill", "circle", "hexagon", "cylinder", "person", "browser", "phone", "folder", "queue", "cloud"],
        labels: ["Box", "Rounded", "Pill", "Circle", "Hexagon", "Cylinder", "Person", "Browser", "Phone", "Folder", "Queue", "Cloud"],
    },
    {
        id: "fill",
        number: 2,
        name: "Fill",
        options: ["none", "pastel", "bold", "hachure", "crosshatch", "dots", "watercolour", "tint", "tiles"],
        labels: ["None", "Pastel", "Bold", "Hachure", "Crosshatch", "Dots", "Watercolour", "Tint + edge", "Tiles"],
    },
    { id: "line", number: 3, name: "Line", options: ["solid", "dashed", "dotted", "weight"], labels: ["Solid", "Dashed", "Dotted", "By weight"] },
    {
        id: "routing",
        number: 4,
        name: "Routing",
        options: ["straight", "elbow", "rounded", "curved", "metro", "bundled"],
        labels: ["Straight", "Elbow", "Rounded elbow", "Curved", "Metro 45", "Bundled"],
    },
    {
        id: "ends",
        number: 5,
        name: "Ends",
        options: ["arrow", "triangle", "hollow", "diamond", "open-diamond", "crowfoot", "dot", "bar", "none"],
        labels: ["Arrow", "Triangle", "Hollow", "Diamond", "Open diamond", "Crow's foot", "Dot", "Bar", "None"],
    },
    {
        id: "edgeLabels",
        number: 6,
        name: "Edge labels",
        options: ["line", "pill", "beside", "numbered", "tag"],
        labels: ["On the line", "Pill", "Beside", "Numbered", "Protocol tag"],
    },
    { id: "type", number: 7, name: "Type voice", options: ["hand", "sans", "mono", "serif"], labels: ["Handwritten", "Clean sans", "Mono", "Serif"] },
    { id: "caps", number: 7, name: "Capitals", options: [false, true], labels: ["Off", "Caps"] },
    { id: "twoLines", number: 7, name: "Two lines", options: [false, true], labels: ["Off", "Two lines"] },
    { id: "icons", number: 8, name: "Icons", options: ["none", "badge", "leading", "tile", "big"], labels: ["None", "Badge", "Leading", "Tile", "Big icon"] },
    {
        id: "depth",
        number: 9,
        name: "Depth",
        options: ["flat", "soft", "hard", "long", "isometric", "glow"],
        labels: ["Flat", "Soft lift", "Hard offset", "Long shadow", "Isometric", "Glow"],
    },
    {
        id: "grouping",
        number: 10,
        name: "Grouping",
        options: ["frame", "dashed", "band", "nested"],
        labels: ["Frame", "Dashed boundary", "Tinted band", "Nested"],
    },
    {
        id: "colorBy",
        number: 11,
        name: "Colour by",
        options: ["category", "tier", "status", "owner", "heat", "accent"],
        labels: ["Category", "Tier", "Status", "Owner", "Heat", "One accent"],
    },
    { id: "density", number: 12, name: "Density", options: ["compact", "regular", "airy"], labels: ["Compact", "Regular", "Airy"] },
    {
        id: "ground",
        number: 13,
        name: "Ground",
        options: ["blank", "dots", "grid", "lines", "paper", "dark"],
        labels: ["Blank", "Dots", "Grid", "Lines", "Paper", "Dark"],
    },
    { id: "legend", number: 14, name: "Legend", options: [false, true], labels: ["Off", "Legend"] },
    { id: "callouts", number: 14, name: "Numbered callouts", options: [false, true], labels: ["Off", "Callouts"] },
    { id: "counts", number: 14, name: "Counts", options: [false, true], labels: ["Off", "Counts"] },
    {
        id: "direction",
        number: 15,
        name: "Layout engine",
        options: ["auto", "top-down", "left-right", "radial", "force", "grid"],
        labels: ["Structure's own", "Top down", "Left right", "Radial", "Force", "Grid"],
    },
];

const LEVER_BY_ID = new Map(LEVERS.map((lever) => [lever.id, lever]));

export const DEFAULT_LEVERS = {
    shape: "rounded",
    fill: "none",
    line: "solid",
    routing: "elbow",
    ends: "triangle",
    edgeLabels: "line",
    type: "sans",
    caps: false,
    twoLines: true,
    icons: "none",
    depth: "flat",
    grouping: "frame",
    colorBy: "category",
    density: "regular",
    ground: "blank",
    legend: false,
    callouts: false,
    counts: false,
    direction: "auto",
};

// Unknown levers and values are dropped, so a stored or model-written override
// can't put anything on the board the painter doesn't understand.
export const sanitizeLevers = (raw = {}) => Object.fromEntries(Object.entries(raw ?? {}).filter(([id, value]) => LEVER_BY_ID.get(id)?.options.includes(value)));

export const DENSITY_SCALE = { compact: { gap: 0.7, font: 13 }, regular: { gap: 1, font: 14 }, airy: { gap: 1.4, font: 16 } };
