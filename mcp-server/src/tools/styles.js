import { z } from "zod";
// Loading the Mermaid runtime is also what hands dagre to the shared layout code.
import "../elements/mermaidRuntime.js";
import { genElementId } from "../connection/boardSession.js";
import { buildDiagram, centreDiagramOn, restyleDiagram, STRUCTURES, LOOKS, LEVERS } from "../../../shared/canvas/diagramStyles/index.js";
import { NODE_KINDS } from "../../../shared/canvas/diagramStyles/model.js";
import { json, placementFields, placeElements, shareIdField } from "./common.js";

const nodeSchema = z.object({
    id: z.string().min(1).max(60),
    label: z.string().min(1).max(160),
    kind: z
        .enum(NODE_KINDS)
        .optional()
        .describe("What the node is: start, end, decision, person, database, queue, service, client, external, column, pro, con and more"),
    detail: z.string().max(400).optional().describe("A second line: a role, a technology or a sentence"),
    parent: z.string().max(60).optional().describe("The node this one sits under in a hierarchy"),
    group: z.string().max(60).optional().describe("Its cluster, set, quadrant or block; 'A & B' for a Venn overlap"),
    lane: z.string().max(60).optional().describe("Who does it, or its branch, stage or column"),
    status: z.string().max(40).optional(),
    value: z.number().optional().describe("A size, amount, score or weight"),
    start: z.number().optional().describe("When it starts, as a number such as a week or year"),
    end: z.number().optional(),
    x: z.number().min(0).max(1).optional().describe("Score on the horizontal axis, 0 to 1 (quadrants, Wardley maps)"),
    y: z.number().min(0).max(1).optional().describe("Score on the vertical axis, 0 to 1"),
});

const recipeFields = {
    structure: z
        .enum(STRUCTURES.map((structure) => structure.id))
        .optional()
        .describe("A structure id from list_diagram_styles"),
    look: z
        .enum(LOOKS.map((look) => look.id))
        .optional()
        .describe("A look id from list_diagram_styles"),
    levers: z
        .record(z.string(), z.union([z.string(), z.boolean()]))
        .optional()
        .describe("Lever overrides by id, e.g. { routing: 'curved', density: 'airy' }"),
};

const elementsOf = (session) => Object.fromEntries(session.listElements());

export const registerStyleTools = (server, { boards }) => {
    server.registerTool(
        "list_diagram_styles",
        {
            title: "List diagram styles",
            description:
                "The 72 structures (where things go), 43 looks (how they are drawn) and the levers a look is made of. Pass detailed: true for each one's full guidance on when to use it.",
            inputSchema: { detailed: z.boolean().optional() },
        },
        async ({ detailed }) =>
            json({
                structures: STRUCTURES.map(({ id, number, name, group, summary, details, bestFor }) => ({
                    id,
                    number,
                    name,
                    group,
                    summary,
                    bestFor,
                    ...(detailed ? { details } : {}),
                })),
                looks: LOOKS.map(({ id, number, name, summary, details }) => ({ id, number, name, summary, ...(detailed ? { details } : {}) })),
                levers: LEVERS.map(({ id, name, options }) => ({ id, name, options })),
            }),
    );

    server.registerTool(
        "draw_styled_diagram",
        {
            title: "Draw a styled diagram",
            description:
                "Draw a diagram from its content in any structure and look, as ordinary editable board elements that remember their style, so a person (or restyle_diagram) can change structure or look later without redoing the content. " +
                "Give only the fields the content really has. Returns the new element ids and the box they occupy.",
            inputSchema: {
                shareId: shareIdField,
                title: z.string().max(120).optional(),
                nodes: z.array(nodeSchema).min(1).max(60),
                edges: z
                    .array(
                        z.object({
                            from: z.string(),
                            to: z.string(),
                            label: z.string().max(120).optional(),
                            kind: z.string().max(30).optional(),
                            value: z.number().optional(),
                        }),
                    )
                    .max(120)
                    .default([]),
                groups: z
                    .array(z.object({ id: z.string().min(1).max(60), label: z.string().max(120), parent: z.string().max(60).optional() }))
                    .max(30)
                    .default([]),
                ...recipeFields,
                ...placementFields,
            },
        },
        async ({ shareId, title, nodes, edges, groups, structure, look, levers, x, y }) => {
            const built = buildDiagram({ model: { title, nodes, edges, groups }, recipe: { structure, look, levers }, generateElementId: genElementId });
            const placed = await placeElements(boards.get(shareId), centreDiagramOn(built, 0, 0), { x, y });
            return json({ ...placed, recipe: built.recipe });
        },
    );

    server.registerTool(
        "restyle_diagram",
        {
            title: "Restyle a diagram",
            description:
                "Redraw a diagram already on the board in another structure, look or lever setting, keeping its content. Give any element of the diagram (or, for one drawn by hand, all its boxes and arrows). " +
                "A new structure lays it out again in the same place; a look on its own repaints it and keeps each box where it is.",
            inputSchema: { shareId: shareIdField, elementIds: z.array(z.string().min(1)).min(1).max(400), ...recipeFields },
        },
        async ({ shareId, elementIds, structure, look, levers }) => {
            const session = boards.get(shareId);
            await session.ensureReady();
            session.assertCanEdit();
            const elements = elementsOf(session);
            const missing = elementIds.filter((id) => !elements[id]);
            if (missing.length) throw new Error(`Not on this board: ${missing.join(", ")}`);
            const result = restyleDiagram({ elements, ids: elementIds, recipe: { structure, look, levers }, generateElementId: genElementId });
            if (!result) throw new Error("Those elements don't hold a diagram: select boxes joined by arrows, or any part of a styled diagram");
            const lowest = Math.min(...result.removeIds.map((id) => elements[id]?.zIndex ?? 0));
            for (const id of result.removeIds) await session.deleteElement(id);
            for (const { elementId, element } of result.elements)
                await session.writeElement("insert", elementId, { ...element, zIndex: lowest + element.zIndex / 1000 });
            return json({ elementIds: result.elements.map(({ elementId }) => elementId), removed: result.removeIds.length, recipe: result.recipe });
        },
    );
};
