import { DOC_PAGES, docTitle, docsPath } from "@/features/docs/docsNavigation";

export const HOSTED_URL = "https://mosaic-collab.vercel.app";

// The public origin every canonical link, sitemap entry and social card points at; inlined at build time.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || HOSTED_URL).replace(/\/+$/, "");

export const absoluteUrl = (path = "/") => new URL(path, `${SITE_URL}/`).toString();

export const SITE_NAME = "Mosaic";
export const SITE_TITLE = "Mosaic";
export const SITE_DESCRIPTION =
    "Mosaic is a free online collaborative whiteboard on an infinite canvas. Draw, diagram and brainstorm together in real time, generate editable diagrams with AI, and replay or branch a board's whole history.";

export const SOCIAL_IMAGE = {
    path: "/og-image.png",
    width: 1200,
    height: 630,
    alt: "Mosaic: scattered thinking, one picture. A real-time collaborative whiteboard.",
};

export const FEATURES = [
    "Real-time multi-user editing with live cursors and presence",
    "Infinite canvas with pan, zoom and viewport-priced rendering",
    "Freehand drawing, shapes, sticky notes, frames, tables and connectors",
    "AI assistant that drafts and edits diagrams you can review before they land",
    "72 diagram structures and 43 visual looks, including Mermaid import",
    "Version history, a replay scrubber, branches and visual diffs",
    "Threaded comments with mentions, roles and share links",
    "Semantic search across every board",
    "Export to PNG, SVG and PDF, and embeddable read-only boards",
    "An MCP server so AI agents such as Claude can read and draw on boards",
];

export const INDEXED_PAGES = [
    { path: "/", title: SITE_TITLE, priority: "1.0" },
    { path: "/about", title: "How Mosaic works", priority: "0.8" },
    ...DOC_PAGES.map((page) => ({ path: docsPath(page.slug), title: docTitle(page), priority: "0.7" })),
    { path: "/help", title: "Mosaic help and guides", priority: "0.6" },
    { path: "/pieces", title: "Mosaic pieces gallery", priority: "0.5" },
];
