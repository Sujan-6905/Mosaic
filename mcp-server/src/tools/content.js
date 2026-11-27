import { z } from "zod";
import { genElementId } from "../connection/boardSession.js";
import { loadMermaid } from "../elements/mermaidRuntime.js";
import { estimatedTextMetrics } from "../../../shared/canvas/layoutEngine.js";
import { buildMermaidElements, MERMAID_KINDS, parseMermaidWith } from "../../../shared/canvas/mermaid/buildMermaidElements.js";
import { elementsFromPiece, pieceFromSelection } from "../../../shared/canvas/pieces/pieces.js";
import { STARTER_SETS } from "../../../shared/canvas/pieces/starterSets.js";
import { json, placementFields, placeElements, shareIdField } from "./common.js";

const starterSummary = (set) => ({
    _id: set._id,
    title: set.title,
    description: set.description,
    starter: true,
    pieces: set.pieces.map(({ id, name }) => ({ id, name })),
});
const ownSummary = (set) => ({
    _id: set._id,
    title: set.title,
    description: set.description,
    published: set.published,
    pieces: set.pieces.map(({ id, name }) => ({ id, name })),
});

const findPieceSet = async (backend, setId) => {
    const starter = STARTER_SETS.find((set) => set._id === setId);
    if (starter) return starter;
    const own = (await backend.listPieceSets()).find((set) => set._id === setId);
    return own ?? backend.getSharedPieceSet(setId);
};

export const registerContentTools = (server, { backend, boards }) => {
    server.registerTool(
        "mermaid_to_board",
        {
            title: "Draw Mermaid on the board",
            description:
                `Turn Mermaid code into real, editable board shapes, laid out the way the board lays out its own diagrams. Supported: ${MERMAID_KINDS.join(", ")}. ` +
                "Subgraphs become frames. Returns the new element ids and the box they occupy, or Mermaid's own error if the code doesn't parse.",
            inputSchema: {
                shareId: shareIdField,
                code: z
                    .string()
                    .min(1)
                    .max(20000)
                    .describe("Mermaid source, starting with its diagram keyword (flowchart, sequenceDiagram, classDiagram, ...)"),
                color: z.string().optional().describe("Ink colour for shapes and arrows, hex; defaults to the board's dark ink"),
                ...placementFields,
            },
        },
        async ({ shareId, code, color, x, y }) => {
            const parsed = await parseMermaidWith(await loadMermaid(), code);
            if (parsed.error) throw new Error(parsed.error);
            const entries = buildMermaidElements(parsed, { metrics: estimatedTextMetrics, color, generateElementId: genElementId });
            return json(await placeElements(boards.get(shareId), entries, { x, y }));
        },
    );

    server.registerTool(
        "list_piece_sets",
        {
            title: "List piece sets",
            description:
                "List the reusable component sets (Pieces) this account can place: the built-in starter sets and the account's own, each with its pieces' ids and names.",
            inputSchema: {},
        },
        async () => json({ starter: STARTER_SETS.map(starterSummary), own: (await backend.listPieceSets()).map(ownSummary) }),
    );

    server.registerTool(
        "place_piece",
        {
            title: "Place a piece",
            description:
                "Place one piece from a set onto a board as fresh elements, with its arrows still joined to its own shapes. Takes a set id from list_piece_sets, or the id of a set someone shared.",
            inputSchema: {
                shareId: shareIdField,
                setId: z.string().min(1),
                piece: z.string().min(1).describe("The piece's id or its name"),
                ...placementFields,
            },
        },
        async ({ shareId, setId, piece, x, y }) => {
            const set = await findPieceSet(backend, setId);
            if (!set) throw new Error(`No piece set "${setId}"`);
            const chosen =
                set.pieces.find((candidate) => candidate.id === piece) ?? set.pieces.find((candidate) => candidate.name.toLowerCase() === piece.toLowerCase());
            if (!chosen) throw new Error(`Set "${set.title}" has no piece "${piece}". It has: ${set.pieces.map(({ name }) => name).join(", ")}`);
            return json({ piece: chosen.name, ...(await placeElements(boards.get(shareId), elementsFromPiece(chosen.elements, genElementId), { x, y })) });
        },
    );

    server.registerTool(
        "search_icons",
        {
            title: "Search icons and logos",
            description:
                "Search the board's icon library: general icons (Lucide, Tabler, Carbon) and product logos (Devicon, SVG Logos, Simple Icons). Returns each match's set and name for place_icon.",
            inputSchema: { query: z.string().min(1).max(60), kind: z.enum(["icons", "logos"]).optional() },
        },
        async ({ query, kind }) => {
            const sets = kind === "logos" ? "devicon,logos,simple-icons" : kind === "icons" ? "lucide,tabler,carbon" : undefined;
            const { icons, total } = await backend.searchIcons(query, sets);
            return json({ total, icons: icons.map(({ set, name, title }) => ({ set, name, title })) });
        },
    );

    server.registerTool(
        "place_icon",
        {
            title: "Place an icon",
            description:
                "Place an icon or logo from search_icons on a board, optionally with a label under it. Line icons take the board's ink; logos keep their own colours.",
            inputSchema: {
                shareId: shareIdField,
                set: z.string().min(1).max(30),
                name: z.string().min(1).max(80),
                size: z.number().min(12).max(400).default(64),
                label: z.string().max(120).optional(),
                ...placementFields,
            },
        },
        async ({ shareId, set, name, size, label, x, y }) => {
            const icon = await backend.getIcon(set, name);
            const iconId = genElementId();
            const entries = [
                {
                    elementId: iconId,
                    element: {
                        type: "shape",
                        shapeType: "Icon",
                        startX: 0,
                        startY: 0,
                        endX: size,
                        endY: size,
                        color: "#000000",
                        size: 0,
                        fillColor: null,
                        opacity: 100,
                        icon,
                        zIndex: 1,
                        rotation: 0,
                        groupId: label ? iconId : null,
                        frameId: null,
                        locked: false,
                    },
                },
            ];
            if (label)
                entries.push({
                    elementId: genElementId(),
                    element: {
                        type: "text",
                        x: -40,
                        y: size + 8,
                        width: size + 80,
                        text: label,
                        color: "#000000",
                        size: 14,
                        align: "center",
                        opacity: 100,
                        zIndex: 2,
                        rotation: 0,
                        groupId: iconId,
                        frameId: null,
                        locked: false,
                    },
                });
            return json(await placeElements(boards.get(shareId), entries, { x, y }));
        },
    );

    server.registerTool(
        "save_piece",
        {
            title: "Save elements as a piece",
            description:
                "Save board elements as a reusable piece in one of this account's sets, or in a new set when no setId is given. Arrows between the saved shapes stay joined.",
            inputSchema: {
                shareId: shareIdField,
                elementIds: z.array(z.string().min(1)).min(1).max(200),
                name: z.string().min(1).max(60),
                setId: z.string().optional().describe("An existing set of yours; omit to start a new set"),
                newSetTitle: z.string().min(1).max(60).optional().describe("Title for the new set when setId is omitted"),
            },
        },
        async ({ shareId, elementIds, name, setId, newSetTitle }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            const elements = Object.fromEntries(session.listElements());
            const missing = elementIds.filter((id) => !elements[id]);
            if (missing.length) throw new Error(`Not on this board: ${missing.join(", ")}`);
            const piece = { name, elements: pieceFromSelection(elements, elementIds) };
            if (setId) return json({ setId, piece: await backend.addPiece(setId, piece) });
            const set = await backend.createPieceSet({ title: newSetTitle ?? "Agent pieces", pieces: [piece] });
            return json({ setId: set._id, piece: set.pieces[0] });
        },
    );
};
