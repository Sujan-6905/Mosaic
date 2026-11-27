// The docs' table of contents: every page in reading order, grouped as the sidebar shows them.
export const DOC_SECTIONS = [
    {
        title: "Getting started",
        pages: [
            { slug: "", title: "Introduction", summary: "What Mosaic is, and where to start." },
            { slug: "quick-start", title: "Quick start", summary: "Your first board, from blank canvas to a shared link in five minutes." },
            { slug: "shortcuts", title: "Keyboard shortcuts", summary: "Every tool key and pointer gesture, searchable by pressing it." },
        ],
    },
    {
        title: "On the board",
        pages: [
            { slug: "drawing", title: "Drawing and shapes", summary: "Freehand ink, the shape library, the eraser, the fill bucket and lasso." },
            { slug: "text-and-notes", title: "Text, notes and tables", summary: "Rich text, sticky notes, tables, and finding words anywhere on a board." },
            {
                slug: "connectors-and-frames",
                title: "Connectors and frames",
                summary: "Arrows that stay attached, elbows and curves, and frames that group a region.",
            },
            { slug: "styling", title: "Styling and arranging", summary: "Colour, fonts, line styles, alignment, grouping, locking and z-order." },
            { slug: "images-and-pieces", title: "Images, icons and pieces", summary: "Pictures, live web embeds, the icon search and reusable piece kits." },
        ],
    },
    {
        title: "Working together",
        pages: [
            { slug: "sharing-and-roles", title: "Sharing and roles", summary: "Inviting people, the four roles, link access and access requests." },
            { slug: "comments", title: "Comments and mentions", summary: "Threads pinned to a spot or a shape, replies, mentions and notifications." },
            { slug: "presenting", title: "Presence and presenting", summary: "Live cursors, following someone's view, presenting and the laser pointer." },
            { slug: "workshops", title: "Workshops", summary: "A shared timer, private dot voting and stamps for running a session." },
        ],
    },
    {
        title: "History",
        pages: [
            {
                slug: "versions-and-replay",
                title: "Versions and replay",
                summary: "Automatic versions, named moments, restoring, forking and the replay scrubber.",
            },
            { slug: "branches-and-merge", title: "Branches and merging", summary: "Trying an idea on a copy, comparing the two, and merging either way." },
        ],
    },
    {
        title: "AI",
        pages: [
            { slug: "assistant", title: "The assistant", summary: "Asking for drawings and edits in words, reviewing drafts, and catching up." },
            { slug: "diagrams", title: "Diagrams and styles", summary: "Seventy-two structures, forty-three looks, Mermaid and GitHub repositories." },
        ],
    },
    {
        title: "Agents",
        pages: [
            { slug: "agents", title: "Connect an agent", summary: "Bring Claude, Claude Code, Cursor, VS Code or Codex onto a board over MCP." },
            { slug: "mcp-tools", title: "MCP tools", summary: "What an agent can read and change, and the safety rails around it." },
        ],
    },
    {
        title: "Beyond the board",
        pages: [
            { slug: "embeds", title: "Embeds and links", summary: "Live boards on other sites, link previews, Slack and cover letters." },
            { slug: "export-and-import", title: "Export and import", summary: "PNG, SVG, PDF, the .mosaic file, time-lapses and importing back." },
            { slug: "account", title: "Your account", summary: "Sign-in, organising boards, search, notifications, tokens and calm mode." },
        ],
    },
    {
        title: "Under the hood",
        pages: [
            { slug: "architecture", title: "Architecture", summary: "How the pieces fit: the client, the live rooms, storage and the assistant." },
            { slug: "self-hosting", title: "Self-hosting", summary: "Running your own Mosaic with Docker, or on Vercel and Render." },
            { slug: "hidden-details", title: "Hidden details", summary: "The small surprises tucked around the app, for those who like to look." },
        ],
    },
];

export const DOC_PAGES = DOC_SECTIONS.flatMap((section) => section.pages.map((page) => ({ ...page, section: section.title })));

export const docsPath = (slug) => (slug ? `/docs/${slug}` : "/docs");

export const docTitle = (page) => (page.slug ? `${page.title} · Mosaic docs` : "Mosaic documentation");

export const findDocPage = (slug) => DOC_PAGES.find((page) => page.slug === slug) ?? null;

export const docNeighbours = (slug) => {
    const index = DOC_PAGES.findIndex((page) => page.slug === slug);
    return { previous: DOC_PAGES[index - 1] ?? null, next: DOC_PAGES[index + 1] ?? null };
};
