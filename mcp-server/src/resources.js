import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SubscribeRequestSchema, UnsubscribeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getElementBounds } from "../../shared/canvas/geometry/bounds.js";

const BOARD_URI = /^mosaic:\/\/boards\/([A-Za-z0-9_-]{1,40})$/;
// Edits arrive in bursts (a diagram is dozens of writes); one notice per burst is enough.
const UPDATE_DEBOUNCE_MS = 1500;

const asJson = (uri, data) => ({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] });

// What an agent needs to reason about a board without a tool call: each
// element's kind, words and box, and the open comments.
const boardSnapshot = (session) => ({
    shareId: session.shareId,
    role: session.role,
    background: session.background,
    elements: [...session.listElements()].map(([id, element]) => ({
        id,
        type: element.type,
        ...(element.shapeType ? { shapeType: element.shapeType } : {}),
        ...(element.text ? { text: element.text } : {}),
        ...(element.diagram ? { diagram: { id: element.diagram.id, role: element.diagram.role, key: element.diagram.key } } : {}),
        bounds: getElementBounds(element),
    })),
    comments: [...session.comments.values()].filter((comment) => !comment.resolved).map(({ _id, text, anchor }) => ({ id: _id, text, anchor })),
});

// Boards as resources an agent can read and subscribe to: a subscription keeps
// the board's live session open and announces each burst of changes.
export const registerBoardResources = (server, { backend, boards }) => {
    server.registerResource(
        "boards",
        "mosaic://boards",
        { title: "Your boards", description: "Every board this account can open, with its shareId and title.", mimeType: "application/json" },
        async (uri) =>
            asJson(
                uri.href,
                (await backend.listBoards()).map(({ shareId, title, updatedAt }) => ({ shareId, title, updatedAt, uri: `mosaic://boards/${shareId}` })),
            ),
    );
    server.registerResource(
        "board",
        new ResourceTemplate("mosaic://boards/{shareId}", {
            list: async () => ({
                resources: (await backend.listBoards()).map(({ shareId, title }) => ({
                    uri: `mosaic://boards/${shareId}`,
                    name: title || shareId,
                    mimeType: "application/json",
                })),
            }),
        }),
        { title: "Board", description: "A board's live content: elements with their words and boxes, and open comments.", mimeType: "application/json" },
        async (uri, { shareId }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            return asJson(uri.href, boardSnapshot(session));
        },
    );

    const watching = new Map();
    server.server.setRequestHandler(SubscribeRequestSchema, async ({ params }) => {
        const match = BOARD_URI.exec(params.uri);
        if (!match) throw new Error(`Only board resources (mosaic://boards/<shareId>) can be watched, not ${params.uri}`);
        if (watching.has(params.uri)) return {};
        const session = boards.get(match[1]);
        await session.ensureReady();
        let timer = null;
        const stop = session.onChange(() => {
            clearTimeout(timer);
            timer = setTimeout(() => server.server.sendResourceUpdated({ uri: params.uri }).catch(() => {}), UPDATE_DEBOUNCE_MS);
        });
        watching.set(params.uri, () => {
            clearTimeout(timer);
            stop();
        });
        return {};
    });
    server.server.setRequestHandler(UnsubscribeRequestSchema, async ({ params }) => {
        watching.get(params.uri)?.();
        watching.delete(params.uri);
        return {};
    });
};
