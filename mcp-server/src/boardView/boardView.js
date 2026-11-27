import { readFileSync } from "node:fs";
import { z } from "zod";
import { getElementBounds } from "../../../shared/canvas/geometry/bounds.js";
import { shareIdField } from "../tools/common.js";

const BOARD_VIEW_URI = "ui://mosaic/board-view.html";
const APP_MIME_TYPE = "text/html;profile=mcp-app";
const MAX_VIEW_ELEMENTS = 1500;
const appHtml = readFileSync(new URL("./boardViewApp.html", import.meta.url), "utf8");

// Just what the in-chat view draws: outlines, words and lines, no styling detail.
const viewElement = (id, element) => {
    const bounds = getElementBounds(element);
    if (!bounds) return null;
    return {
        id,
        type: element.type,
        shapeType: element.shapeType ?? null,
        bounds,
        start: element.type === "connector" ? { x: element.startX, y: element.startY } : null,
        end: element.type === "connector" ? { x: element.endX, y: element.endY } : null,
        waypoints: element.waypoints ?? null,
        points: element.type === "path" ? element.points.filter((_, index) => index % 2 === 0).map(({ x, y }) => [Math.round(x), Math.round(y)]) : null,
        text: element.text ? String(element.text).slice(0, 200) : null,
        color: element.color ?? null,
        fillColor: element.fillColor ?? null,
        dashed: element.strokeStyle === "dashed",
        zIndex: element.zIndex ?? 0,
    };
};

const boardViewData = (session, appUrl) => ({
    shareId: session.shareId,
    url: `${appUrl}/?shareId=${encodeURIComponent(session.shareId)}`,
    elements: [...session.listElements()]
        .map(([id, element]) => viewElement(id, element))
        .filter(Boolean)
        .sort((a, b) => a.zIndex - b.zIndex)
        .slice(-MAX_VIEW_ELEMENTS),
});

// A live board inside the chat (MCP Apps): the app sits beside the tool result and stays
// current by calling show_board again while on screen.
export const registerBoardView = (server, { boards, appUrl }) => {
    server.registerResource(
        "board-view",
        BOARD_VIEW_URI,
        {
            title: "Board view",
            description: "An interactive view of a Mosaic board for agent apps that show tool results inline.",
            mimeType: APP_MIME_TYPE,
            _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } } },
        },
        async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME_TYPE, text: appHtml }] }),
    );
    server.registerTool(
        "show_board",
        {
            title: "Show board",
            description:
                "Show a board in the conversation as a live view that keeps up with edits, with a link to open it in Mosaic. " +
                "Call it after drawing so the person sees the result without leaving the chat.",
            inputSchema: { shareId: shareIdField, title: z.string().max(200).optional().describe("A caption for the view") },
            _meta: { ui: { resourceUri: BOARD_VIEW_URI } },
        },
        async ({ shareId, title }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            const view = { ...boardViewData(session, appUrl), title: title ?? null };
            return {
                content: [{ type: "text", text: `Board ${shareId}: ${view.elements.length} elements. Open it at ${view.url}` }],
                structuredContent: view,
            };
        },
    );
};
