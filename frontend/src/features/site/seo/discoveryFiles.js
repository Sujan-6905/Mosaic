// The plain-text files crawlers and AI assistants fetch to find and describe the site.
import { DECISIONS, HELP_GUIDE_ORDER, SOURCE_URL } from "../siteContent";
import { TOUR_TRACKS } from "@/features/tour/tourSteps";
import { FEATURES, INDEXED_PAGES, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "./siteMetadata";

const PRIVATE_PATHS = ["/api/", "/dashboard", "/profile", "/oauth/", "/letter/", "/pieces/"];
const AI_CRAWLERS = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "DeepSeekBot",
];

export const robotsTxt = () => {
    const rules = ["Allow: /", ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`)];
    const group = (agent) => [`User-agent: ${agent}`, ...rules].join("\n");
    return [group("*"), ...AI_CRAWLERS.map(group), `Sitemap: ${absoluteUrl("/sitemap.xml")}`, ""].join("\n\n");
};

export const sitemapXml = (lastModified = new Date().toISOString().slice(0, 10)) => {
    const urls = INDEXED_PAGES.map(
        ({ path, priority }) => `  <url><loc>${absoluteUrl(path)}</loc><lastmod>${lastModified}</lastmod><priority>${priority}</priority></url>`,
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
};

const AGENT_SECTION = `## For AI agents

- [MCP server](${absoluteUrl("/mcp")}): Streamable HTTP MCP endpoint. Agents such as Claude, Cursor and VS Code sign in with OAuth 2.1 or a personal access token, then list, read, create and edit boards live alongside people.
- Add it to Claude Code with: \`claude mcp add --transport http mosaic ${absoluteUrl("/mcp")}\``;

export const llmsTxt = () => `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is a web app, free to use in any modern browser with nothing to install. It suits teams that brainstorm, sketch system architecture, run retrospectives, map user flows or teach on a shared canvas, and people looking for an online whiteboard in the spirit of Miro, FigJam or Excalidraw.

## Pages

${INDEXED_PAGES.map(({ path, title }) => `- [${title}](${absoluteUrl(path)})`).join("\n")}
- [Full product description](${absoluteUrl("/llms-full.txt")}): every feature, design decision and guide in one file

${AGENT_SECTION}

## Source

- [Source code on GitHub](${SOURCE_URL})
`;

const guideText = (track) => track.steps.map((step) => `- **${step.title}**: ${step.body}`).join("\n");

export const llmsFullTxt = () => `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Website: ${SITE_URL}

## Features

${FEATURES.map((feature) => `- ${feature}`).join("\n")}

## How it is built

${DECISIONS.map((decision) => `### ${decision.title}\n\n${decision.body}`).join("\n\n")}

${AGENT_SECTION}

## Guides

${HELP_GUIDE_ORDER.map((id) => `### ${TOUR_TRACKS[id].label}\n\nRead online: ${absoluteUrl(`/help#${id}`)}\n\n${guideText(TOUR_TRACKS[id])}`).join("\n\n")}
`;

// Served from getServerSideProps, so the files always carry the deployment's own address.
export const sendTextFile = (res, contentType, body) => {
    res.setHeader("Content-Type", `${contentType}; charset=utf-8`);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.end(body);
    return { props: {} };
};
