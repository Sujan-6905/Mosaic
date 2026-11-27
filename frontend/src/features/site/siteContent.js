// Every figure in MEASUREMENTS comes from frontend/perf/README.md; an unsourced number is worse than none.

export const HERO = {
    eyebrow: "Real-time collaborative canvas",
    title: "Scattered thinking,",
    accent: "one picture.",
    lede: "An infinite whiteboard where a whole room draws at once, and the board keeps a record of how it got there.",
};

export const CHAPTERS = [
    {
        id: "surface",
        kicker: "The surface",
        title: "No edges, and no slowdown for having them.",
        body: "Pan and zoom forever. Only what is on screen gets painted, so a huge board feels as light as an empty one.",
        asset: "field",
        figure: "grid",
    },
    {
        id: "room",
        kicker: "The room",
        title: "Everyone draws at once.",
        body: "Live cursors and presence, comments with mentions, follow-along presenting, a timer and dot votes for workshops, and roles that decide who can change what.",
        asset: "presence",
        figure: "presence",
    },
    {
        id: "record",
        kicker: "The record",
        title: "The board remembers how it was made.",
        body: "Scrub through every change, restore a named version, or branch the board, compare it with the original and merge it back.",
        asset: "history",
        figure: "timeline",
    },
    {
        id: "assist",
        kicker: "The assist",
        title: "Ask the board for changes, in words.",
        body: "The assistant edits what is already there, explains a busy board and catches you up on what changed. Every edit arrives as a draft you review before it lands.",
        asset: "assist",
        figure: "bubble",
    },
    {
        id: "diagrams",
        kicker: "The diagrams",
        title: "Describe a diagram. Get one you can edit.",
        body: "Seventy-two structures in forty-three looks, from a sentence, a Mermaid file or a public GitHub repository. Every node stays a real shape you can move.",
        asset: "graph",
        figure: "graph",
    },
    {
        id: "agents",
        kicker: "The agents",
        title: "Your agents join the board too.",
        body: "Claude Code, Cursor, Codex or any MCP client signs in and works beside you, with its own cursor, its name in presence and an undo for every turn it takes.",
        asset: "agent",
        figure: "agent",
    },
];

export const EXTRAS = [
    "Sticky notes",
    "Frames",
    "Connectors",
    "Tables",
    "Rich text",
    "Find on the board",
    "Shape and icon library",
    "Reusable piece kits",
    "Live embeds on any site",
    "Export to PNG, SVG, PDF",
    "Time-lapse export",
    "Command palette",
];

export const STACK = [
    { label: "Client", value: "Next.js, React, Redux Toolkit, layered canvas" },
    { label: "Transport", value: "Socket.io with per-event schema validation" },
    { label: "Server", value: "Express, operation log, write-behind autosave" },
    { label: "Storage", value: "Couchbase Capella, Redis for live room state" },
    { label: "Assist", value: "Hosted LLM, local layout engine, grounding" },
    { label: "Agents", value: "MCP over the same live socket, OAuth 2.1" },
];

export const DECISIONS = [
    {
        id: "conflict",
        kicker: "Conflict",
        title: "Last-write-wins for shapes, a CRDT for text",
        body: "Whiteboard elements are independent objects, so per-element last-write-wins is enough: the server stamps a monotonic version on every accepted change and clients only apply what outranks what they hold. Two people typing in one sticky note must both keep their words, so text runs a CRDT instead.",
    },
    {
        id: "canvas",
        kicker: "Canvas",
        title: "An infinite canvas that costs what you can see",
        body: "The camera is a pure coordinate transform with no upper limit, and a spatial index answers what is visible right now without scanning every element. Committed elements paint on a static layer outside React; in-progress strokes live on an overlay. A repaint is priced by the viewport, not the board.",
    },
    {
        id: "history",
        kicker: "History",
        title: "An append-only log, three ways to read it",
        body: "Every mutation is appended to an operation log with periodic snapshots. Version history, the replay scrubber and branch diffing are three readings of that one log, which is why forking from a point in the past is cheap and replay shows what actually happened.",
    },
    {
        id: "assist",
        kicker: "Assist",
        title: "The model never gets to place anything",
        body: "The diagram prompt contract has no coordinates in it anywhere. The model returns nodes and edges; a deterministic layout engine computes every position in the browser. Output is schema-validated server-side with a single self-repair retry, and the API key never leaves the backend.",
    },
    {
        id: "styles",
        kicker: "Diagrams",
        title: "Structure and look are chosen apart",
        body: "Seventy-two structures are presets of fifteen layout families, and forty-three looks restyle any of them. The model only names a structure and a look; the layout engine places every node, so a finished diagram can be restyled in one step instead of being redrawn.",
    },
    {
        id: "boundary",
        kicker: "Boundary",
        title: "Validation at the boundary, not just authentication",
        body: "A valid token proves who is talking, not that what they say is well formed. Every socket event carries its own schema: identifiers, operations, element shapes, point counts and payload sizes are all checked, and a malformed frame is dropped before it can desync a room.",
    },
    {
        id: "scale",
        kicker: "Scale",
        title: "Rooms in shared storage, so instances are interchangeable",
        body: "Room state sits behind one storage interface: in-memory for a single process, Redis when configured. With Redis no part of a room lives in one instance, so a load balancer can round-robin connections and losing an instance mid-session loses nothing.",
    },
    {
        id: "agents",
        kicker: "Agents",
        title: "Agents join as collaborators, not through a side door",
        body: "An MCP client connects over the same socket a person uses, so its edits pass the same schemas, roles and conflict rule, and everyone sees its cursor. Sign-in is OAuth with tokens that can be limited to one board, and every turn an agent takes is recorded so it can be undone in one step.",
    },
    {
        id: "grounding",
        kicker: "Grounding",
        title: "The model reasons over refs, never pixels or ids",
        body: "Editing a board needs the model to know what is there: a scene graph, structural and temporal grouping, a relation graph and a resolver. Structural grouping alone took top-1 resolution from 59% to 72% on a 54-case set. Every edit still passes a shadow scene and a linter before it touches the live board.",
    },
];

export const CAPABILITIES = [
    {
        area: "Canvas engine",
        items: [
            "Infinite canvas coordinate space",
            "Camera model for pan and zoom",
            "Spatial index for hit-testing",
            "Viewport culling and cached bitmap tiles",
            "Level-of-detail rendering",
            "Pressure-sensitive freehand with pen, pencil and highlighter",
            "Canvas backgrounds",
            "Performance budgets and a benchmark harness",
        ],
    },
    {
        area: "Editing",
        items: [
            "Marquee, multi-select and lasso select",
            "Group, ungroup and step into groups",
            "Snapping, alignment guides, align and distribute",
            "Z-order with fractional indexing",
            "Rotate, flip, lock, duplicate and clipboard",
            "Colour wheel, hex input, eyedropper and recents",
            "Undo and redo across every operation",
            "Command palette and full keyboard shortcuts",
        ],
    },
    {
        area: "Content",
        items: [
            "Rich text with collaborative editing",
            "Sticky notes that fit their text",
            "Tables with header rows and four styles",
            "Frames and sections",
            "Connectors bound to elements, with labels, curves and elbows",
            "Shape library and icon search",
            "Images, crop and live web embeds",
            "Find on the board",
        ],
    },
    {
        area: "Collaboration",
        items: [
            "Live cursors and presence",
            "Follow-along presentation mode",
            "Comments with threads, replies, resolve and mentions",
            "Owner, Editor, Commenter and Viewer roles",
            "Link access and access requests",
            "Live role changes",
            "Laser pointer",
            "Shared timer, private dot voting and stamps",
        ],
    },
    {
        area: "History and data",
        items: [
            "Append-only operation log with snapshots",
            "Version history: browse, restore and fork",
            "Board replay scrubber",
            "Branches, visual diff and three-way merge",
            "Catch me up on what changed",
            "Export to PNG, SVG, PDF, time-lapse and scene file",
            "Import a scene file into a new board or this one",
            "Recently deleted, kept for 30 days",
        ],
    },
    {
        area: "AI assistant",
        items: [
            "Drafts diagrams and drawings from a sentence",
            "Edits existing content from plain language",
            "Every edit previewed as a draft before it lands",
            "Grounding: scene graph, groups and a relation graph",
            "72 diagram structures in 43 looks, with one-step restyle",
            "Mermaid to editable diagram",
            "Architecture diagrams from a GitHub repository",
            "Tidy up a hand-drawn diagram",
        ],
    },
    {
        area: "Agents and MCP",
        items: [
            "Hosted MCP server on the app's own address",
            "OAuth sign-in with read-only or read-and-edit access",
            "Personal access tokens, limitable to chosen boards",
            "Per-board agent permissions",
            "Agents named in presence with their own cursor",
            "Activity list with an undo for every agent turn",
            "Prompts, board resources and change subscriptions",
            "A live board view inside MCP Apps clients",
        ],
    },
    {
        area: "Sharing",
        items: [
            "Live, read-only embeds on allowed sites",
            "Frame, branch and saved-version embeds",
            "A message API for the host page",
            "oEmbed and Slack link unfurling",
            "Cover letters: a board that draws itself",
            "Reusable piece kits and a public gallery",
            "Semantic search across every board",
            "Categories, starring and a home page laid out like a board",
        ],
    },
    {
        area: "Platform",
        items: [
            "Username-first identity with social sign-in",
            "Short-lived sessions with rotating refresh tokens",
            "Redis-backed rooms for multi-instance scaling",
            "Schema validation on every socket event and request",
            "Observability, metrics, alerts and error reporting",
            "Light and dark themes on a shared token system",
            "Touch, pinch-zoom and mobile support",
            "Keyboard, screen-reader and calm-mode accessibility",
        ],
    },
];

export const CAPABILITY_COUNT = CAPABILITIES.reduce((total, group) => total + group.items.length, 0);

// The guides /help shows, in reading order; keys of TOUR_TRACKS.
export const HELP_GUIDE_ORDER = [
    "basics",
    "arrows",
    "tables",
    "collaboration",
    "workshop",
    "ai",
    "diagramStyles",
    "architecture",
    "catchUp",
    "versions",
    "replay",
    "branches",
    "pieces",
    "files",
    "shortcuts",
    "organisation",
];

export const SOURCE_URL = "https://github.com/Sujan-6905/Mosaic";

// The footer's third column explains the name rather than listing the page's fonts and libraries.
export const NAME_NOTE = {
    heading: "Why Mosaic",
    body: "A mosaic is a picture no single tessera can carry. It only resolves once every piece is set next to the others, which is the whole argument for drawing something with other people rather than alone.",
};
