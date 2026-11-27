import { nextZIndex } from "../../../shared/canvas/editing/zOrder.js";
import { z } from "zod";
import { ARROWHEADS, CONNECTOR_ROUTINGS } from "../../../shared/canvas/elements/connectors.js";
import { genElementId } from "../connection/boardSession.js";
import { CANVAS_SHAPE_NAMES, buildElement, applyPatch } from "../elements/elementDefaults.js";
import { summarizeElement, buildElementRefs } from "../elements/elementSummary.js";
import { json, shareIdField, showWorkAt } from "./common.js";
import { fontFieldsFor } from "../../../shared/canvas/elements/fontSources.js";
import { isHostedUpload } from "../../../shared/canvas/elements/hostedUploads.js";
import { changedFields } from "../../../shared/canvas/editing/changedFields.js";

const colorField = z.string().describe("Hex color, e.g. #ef4444").optional();
const shapeTypeField = z.enum(Object.keys(CANVAS_SHAPE_NAMES));
const lineStyleField = z.enum(["solid", "dashed", "dotted"]).optional().describe("Line style, defaults to solid");
// A linked font file is copied into the app's uploads before any board uses it.
const fontFields = async (backend, font) => {
    const fields = fontFieldsFor(font);
    if (fields.error) throw new Error(`font: ${fields.error}`);
    if (!fields.fileLink) return fields;
    const family = fields.fontFamily.split(",")[0].replace(/'/g, "");
    return { fontFamily: fields.fontFamily, fontSource: { kind: "file", url: await backend.copyLinkedFont(fields.fileLink, family) } };
};

const fontField = z
    .string()
    .optional()
    .describe(
        "A web-safe family (Arial, Georgia, Courier New...), any Google Fonts family name (Caveat, Space Grotesk...), or an https link to a .woff2/.woff/.ttf/.otf file",
    );
const handField = z.number().min(0).max(3).optional().describe("How hand-drawn the line looks: 0 ruled, 0.7 steady, 1.6 loose, 2.8 wild");
const headField = z.enum(ARROWHEADS).optional();
const backgroundTypeField = z.enum(["blank", "dot", "square", "lined", "isometric", "solid"]);

export const registerBoardTools = (server, { backend, boards }) => {
    server.registerTool(
        "list_boards",
        {
            title: "List boards",
            description: "List every whiteboard this account owns or has been given access to.",
            inputSchema: {},
        },
        async () => json(await backend.listBoards()),
    );

    server.registerTool(
        "create_board",
        {
            title: "Create board",
            description: "Create a new, empty whiteboard and return its shareId.",
            inputSchema: { title: z.string().min(1).max(200) },
        },
        async ({ title }) => json(await backend.createBoard(title)),
    );

    server.registerTool(
        "get_board_state",
        {
            title: "Get board state",
            description:
                "Read a board's current live content: its background, role you hold on it, and every element " +
                "(or only elements of one type, and/or only elements overlapping a given box). Joins the board's " +
                "live collaborative session on first use, the same way opening it in a browser would.",
            inputSchema: {
                shareId: shareIdField,
                type: z.enum(["path", "shape", "text", "sticky", "frame", "connector", "image"]).optional().describe("Only return elements of this type"),
                withinBounds: z
                    .object({ minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number() })
                    .optional()
                    .describe("Only return elements whose bounds intersect this box"),
            },
        },
        async ({ shareId, type, withinBounds }) => {
            const session = boards.get(shareId);
            await session.ensureReady();

            const canonicalScene = buildElementRefs(session.listElements());
            let elements = [...session.listElements().entries()].map(([id, el]) => summarizeElement(id, el, canonicalScene));
            if (type) elements = elements.filter((el) => el.type === type);
            if (withinBounds) {
                elements = elements.filter((el) => {
                    if (!el.bounds) return false;
                    return (
                        el.bounds.minX <= withinBounds.maxX &&
                        el.bounds.maxX >= withinBounds.minX &&
                        el.bounds.minY <= withinBounds.maxY &&
                        el.bounds.maxY >= withinBounds.minY
                    );
                });
            }

            return json({
                shareId,
                role: session.role,
                background: session.background,
                elementCount: session.listElements().size,
                elements,
            });
        },
    );

    server.registerTool(
        "get_element",
        {
            title: "Get element",
            description: "Read a single element by id from a board's live state.",
            inputSchema: { shareId: shareIdField, elementId: z.string().min(1) },
        },
        async ({ shareId, elementId }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            const element = session.listElements().get(elementId);
            if (!element) throw new Error(`No element "${elementId}" on board "${shareId}"`);
            const canonicalScene = buildElementRefs(session.listElements());
            return json(summarizeElement(elementId, element, canonicalScene));
        },
    );

    server.registerTool(
        "describe_board",
        {
            title: "Describe board",
            description:
                "Get a grounded, symbolic description of a board: every object as a stable ref plus its kind and " +
                "name, and the spatial/structural relations between them: above, below, left-of, right-of, " +
                "inside, inside-frame, connected-to, aligned-with, nearest-label. Prefer this over get_board_state " +
                "when the task is understanding how things relate rather than reading raw element fields. To act " +
                "on something this describes, call resolve with the same description you'd use to point at it, " +
                "which returns the real element id.",
            inputSchema: {
                shareId: shareIdField,
                selection: z.array(z.string()).optional().describe("Refs currently selected or relevant, if any; improves ranking on a later resolve call"),
            },
        },
        async ({ shareId, selection }) => json(await backend.getBoardContext(shareId, { selection })),
    );

    server.registerTool(
        "resolve",
        {
            title: "Resolve a description to a board object",
            description:
                'Resolve a natural-language description ("the box under the login step", "the sticky note ' +
                'about OAuth") to the object(s) it refers to. Returns { status: "resolved" } with one confident ' +
                'match, { status: "ambiguous" } with a ranked shortlist to disambiguate with the user, or ' +
                '{ status: "none" } when nothing plausible was found. Each candidate carries a real elementId; ' +
                "pass that straight to get_element/update_element/delete_element.",
            inputSchema: {
                shareId: shareIdField,
                description: z.string().min(1).max(300),
                selection: z.array(z.string()).optional(),
            },
        },
        async ({ shareId, description, selection }) => json(await backend.resolveBoardReference(shareId, description, { selection })),
    );

    server.registerTool(
        "edit_board",
        {
            title: "Edit board",
            description:
                'Edit existing board content from a natural-language instruction ("align the login and signup ' +
                'boxes", "move the sticky note below the frame", "make the arrow connect these two boxes"). ' +
                "Runs server-side: resolves the instruction against the board's real objects, validates and " +
                "sanitizes the resulting operations, applies them to a speculative copy first, lints that copy for " +
                "problems (overlaps, off-canvas content, broken bindings), auto-repairs what it safely can, and " +
                "only then commits, broadcasting live to every collaborator and landing in the same undo/redo, " +
                'version history and op log a human edit does. Returns { status: "applied" } with a diff of what ' +
                'changed, { status: "no-op" } when nothing needed to change, or a specific failure status ' +
                '("conflict" if the board changed mid-edit, "unauthorized" if access was lost, "rejected" if ' +
                "nothing in the instruction resolved to a real object). It never takes a raw coordinate: this tool " +
                "only moves existing content relative to itself. A large or destructive change comes back as " +
                '{ status: "needs-review" } instead of being applied, and a request that isn\'t an edit comes back ' +
                'as { status: "reply" } or { status: "diagram" } without touching the board. Use add_shape/add_text/etc. to create new ' +
                "content instead; use this to rearrange, restyle, connect, or remove what's already there.",
            inputSchema: { shareId: shareIdField, instruction: z.string().min(1).max(500) },
        },
        async ({ shareId, instruction }) => json(await backend.editBoard(shareId, instruction)),
    );

    const insertTool = (name, { title, description, type, fields, prepare = (prepared) => prepared }) => {
        server.registerTool(
            name,
            {
                title,
                description,
                inputSchema: { shareId: shareIdField, ...fields },
            },
            async ({ shareId, font, ...rawFields }) => {
                const elementId = genElementId();
                const element = buildElement(type, { ...(await prepare(rawFields)), ...(font ? await fontFields(backend, font) : {}) });
                const session = boards.get(shareId);
                await session.ensureReady();
                await showWorkAt(session, element);
                const stored = await session.writeElement("insert", elementId, { ...element, zIndex: nextZIndex([...session.listElements().values()]) });
                return json(summarizeElement(elementId, stored));
            },
        );
    };

    insertTool("add_shape", {
        title: "Add shape",
        description:
            "Draw any board shape (rectangle, circle, diamond, database, cloud, document and more) between two corner points, optionally with words inside.",
        type: "shape",
        fields: {
            shapeType: shapeTypeField,
            startX: z.number(),
            startY: z.number(),
            endX: z.number(),
            endY: z.number(),
            color: colorField.describe("Border color, hex, defaults to #000000"),
            fillColor: z.string().nullable().optional().describe("Fill color, hex, or null for no fill"),
            size: z.number().optional().describe("Border thickness in px, defaults to 2"),
            opacity: z.number().min(1).max(100).optional().describe("1-100, defaults to 100"),
            text: z.string().max(5000).optional().describe("Words inside the shape; they shrink to fit and the shape grows if needed"),
            subtext: z.string().max(1000).optional().describe("A smaller second line under the text"),
            fontSize: z.number().min(4).max(400).optional(),
            font: fontField,
            fillStyle: z.enum(["solid", "hachure", "crosshatch", "dots"]).optional(),
            strokeStyle: lineStyleField,
            cornerRadius: z.number().min(0).max(1000).optional().describe("Curved corners in px, for any outlined shape"),
            roughness: handField,
        },
    });

    insertTool("add_text", {
        title: "Add text",
        description: "Place a text box at a position with a fixed wrap width.",
        type: "text",
        fields: {
            x: z.number(),
            y: z.number(),
            width: z.number().describe("Wrap width in px"),
            text: z.string().min(1).max(5000),
            color: colorField,
            size: z.number().optional().describe("Font size in px, defaults to 16"),
            fontWeight: z.enum(["normal", "bold"]).optional(),
            fontStyle: z.enum(["normal", "italic"]).optional(),
            align: z.enum(["left", "center", "right"]).optional(),
            font: fontField,
        },
    });

    insertTool("add_sticky_note", {
        title: "Add sticky note",
        description: "Place a sticky note with a filled background and wrapped text.",
        type: "sticky",
        fields: {
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
            text: z.string().max(5000).default(""),
            color: colorField.describe("Text color, defaults to #000000"),
            fillColor: z.string().optional().describe("Note color, hex, defaults to #fef08a"),
            size: z.number().optional().describe("Font size in px, defaults to 16"),
            font: fontField,
        },
    });

    insertTool("add_frame", {
        title: "Add frame",
        description: "Add a named frame (a labelled container region) spanning a box.",
        type: "frame",
        fields: {
            startX: z.number(),
            startY: z.number(),
            endX: z.number(),
            endY: z.number(),
            name: z.string().min(1).max(100),
            color: colorField,
        },
    });

    insertTool("add_connector", {
        title: "Add connector",
        description: "Draw an arrow/line connecting two points, optionally bound to existing element ids so it tracks " + "them if they move.",
        type: "connector",
        fields: {
            startX: z.number(),
            startY: z.number(),
            endX: z.number(),
            endY: z.number(),
            startElementId: z.string().nullable().optional(),
            endElementId: z.string().nullable().optional(),
            color: colorField,
            size: z.number().optional(),
            opacity: z.number().min(1).max(100).optional(),
            arrowStart: z.boolean().optional(),
            arrowEnd: z.boolean().optional().describe("Defaults to true"),
            startHead: headField.describe("Head at the start, defaults to none"),
            endHead: headField.describe("Head at the end, defaults to triangle"),
            routing: z.enum(CONNECTOR_ROUTINGS).optional().describe("straight, curved or elbow"),
            text: z.string().max(200).optional().describe("A label on the arrow"),
            strokeStyle: lineStyleField,
            roughness: handField,
        },
    });

    insertTool("add_path", {
        title: "Add freehand path",
        description: "Draw a freehand stroke through an ordered list of points.",
        type: "path",
        fields: {
            points: z.array(z.object({ x: z.number(), y: z.number(), pressure: z.number().min(0).max(1).optional() })).min(1),
            color: colorField,
            size: z.number().optional(),
            opacity: z.number().min(1).max(100).optional(),
            style: z.string().optional().describe("Stroke cap style, e.g. round, square, butt"),
        },
    });

    insertTool("add_image", {
        title: "Add image",
        description: "Place an image into a box on the board. A PNG, JPEG, GIF or WebP link is copied into the board's own storage first.",
        type: "image",
        prepare: async (fields) => (isHostedUpload(fields.src, "image") ? fields : { ...fields, ...(await backend.copyLinkedImage(fields.src)) }),
        fields: {
            startX: z.number(),
            startY: z.number(),
            endX: z.number(),
            endY: z.number(),
            src: z.string().url(),
            opacity: z.number().min(1).max(100).optional(),
        },
    });

    server.registerTool(
        "update_element",
        {
            title: "Update element",
            description:
                "Patch an existing element: pass only the fields to change (e.g. move it by changing x/y or " +
                "startX/startY/endX/endY, recolor it, resize it, retext it). The element keeps its type and every " +
                "field you don't mention.",
            inputSchema: {
                shareId: shareIdField,
                elementId: z.string().min(1),
                patch: z.record(z.string(), z.any()).describe("Partial element fields to overwrite"),
            },
        },
        async ({ shareId, elementId, patch }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            const existing = session.listElements().get(elementId);
            if (!existing) throw new Error(`No element "${elementId}" on board "${shareId}"`);

            const updated = applyPatch(existing, patch);
            const changed = changedFields(existing, updated);
            const stored = changed.length ? await session.writeElement("update", elementId, updated, { changed }) : existing;
            return json(summarizeElement(elementId, stored));
        },
    );

    server.registerTool(
        "delete_element",
        {
            title: "Delete element",
            description: "Remove a single element from the board.",
            inputSchema: { shareId: shareIdField, elementId: z.string().min(1) },
        },
        async ({ shareId, elementId }) => {
            const session = boards.get(shareId);
            await session.deleteElement(elementId);
            return json({ deleted: elementId });
        },
    );

    server.registerTool(
        "set_background",
        {
            title: "Set background",
            description: "Change the board's background pattern/color.",
            inputSchema: {
                shareId: shareIdField,
                type: backgroundTypeField,
                colorToken: z.enum(["bg-canvas", "bg-sunken", "bg-surface", "accent-muted"]).optional().describe('Required when type is "solid"'),
            },
        },
        async ({ shareId, type, colorToken }) => {
            const session = boards.get(shareId);
            const background = await session.setBackground({ type, colorToken: colorToken ?? null });
            return json(background);
        },
    );

    server.registerTool(
        "clear_board",
        {
            title: "Clear board",
            description:
                "Delete every element on the board. Requires ownership. Destructive and not undoable through " +
                "this tool, so confirm with the user before calling it on a board with content you didn't just create.",
            inputSchema: { shareId: shareIdField },
        },
        async ({ shareId }) => {
            const session = boards.get(shareId);
            const deletedCount = await session.clearBoard();
            return json({ shareId, deletedCount });
        },
    );
};
