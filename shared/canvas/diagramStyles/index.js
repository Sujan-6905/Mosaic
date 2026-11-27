// Turns a content model, a structure and a look into ordinary board elements.
import { routeAroundNodes } from "./layouts/avoidNodes.js";
import { estimatedTextMetrics } from "../layoutEngine.js";
import { translateElement } from "../geometry/elementGeometry.js";
import { getUnionBounds } from "../geometry/bounds.js";
import { normalizeDiagramModel, deriveTree } from "./model.js";
import { resolveStyle, structureFor, lookFor, DEFAULT_LOOK_ID } from "./catalog.js";
import { sanitizeLevers, DENSITY_SCALE } from "./levers.js";
import { nodeShapeFor, sizeNode } from "./nodeShapes.js";
import { assignCategories } from "./paint/colors.js";
import { createZCounter, fontFor } from "./paint/elements.js";
import { paintNodes } from "./paint/nodes.js";
import { paintEdges } from "./paint/edges.js";
import { paintGroups } from "./paint/groups.js";
import { paintMarks } from "./paint/marks.js";
import { paintGround, paintLegend, paintCallouts, paintTitle } from "./paint/decor.js";
import { sceneBounds } from "./layouts/common.js";
import { layoutTree } from "./layouts/tree.js";
import { layoutRadial } from "./layouts/radial.js";
import { layoutLayered } from "./layouts/layered.js";
import { layoutLanes } from "./layouts/lanes.js";
import { layoutMatrix } from "./layouts/matrix.js";
import { layoutNested } from "./layouts/nested.js";
import { layoutTimeline } from "./layouts/timeline.js";
import { layoutCircular } from "./layouts/circular.js";
import { layoutForce } from "./layouts/force.js";
import { layoutStack } from "./layouts/stack.js";
import { layoutSequence } from "./layouts/sequence.js";
import { layoutSankey, layoutFishbone, layoutCards } from "./layouts/flows.js";
import { layoutDecisionPath } from "./layouts/decisionPath.js";

export * from "./catalog.js";
export { LEVERS, DEFAULT_LEVERS, sanitizeLevers } from "./levers.js";
export { normalizeDiagramModel } from "./model.js";

const FAMILIES = {
    tree: layoutTree,
    radial: layoutRadial,
    layered: layoutLayered,
    lanes: layoutLanes,
    matrix: layoutMatrix,
    nested: layoutNested,
    timeline: layoutTimeline,
    circular: layoutCircular,
    force: layoutForce,
    stack: layoutStack,
    sequence: layoutSequence,
    sankey: layoutSankey,
    fishbone: layoutFishbone,
    cards: layoutCards,
    decision: layoutDecisionPath,
};

// The layout-engine lever swaps in a family of its own, keeping the structure's notation.
const LEVER_FAMILIES = { radial: "radial", force: "force", grid: "cards" };

const SPOTLIT_STATUS = /^(active|highlight|highlighted|focus|lit|current)$/i;

// The nodes the Spotlight look lights: the ones marked, else the longest path from the root.
const spotlitNodes = (model) => {
    const marked = model.nodes.filter((node) => SPOTLIT_STATUS.test(node.status ?? "")).map((node) => node.id);
    if (marked.length) return new Set(marked);
    const tree = deriveTree(model);
    let best = [];
    const walk = (id, path) => {
        const next = [...path, id];
        if (next.length > best.length) best = next;
        tree.childrenOf.get(id)?.forEach((child) => walk(child, next));
    };
    if (tree.rootId) walk(tree.rootId, []);
    return new Set(best);
};

const STRAGGLER_GAP = 40;

// A node a structure has no place for still goes on the board, in a row
// beneath the diagram, so restyling never loses content.
const placeStragglers = (scene, model, sizes) => {
    const drawnElsewhere = new Set(scene.drawnElsewhere ?? []);
    const missing = model.nodes.filter((node) => !scene.nodes[node.id] && !drawnElsewhere.has(node.id));
    if (missing.length === 0) return;
    const bounds = Object.keys(scene.nodes).length ? sceneBounds(scene) : { minX: 0, maxY: 0 };
    let x = bounds.minX;
    missing.forEach((node) => {
        const size = sizes.get(node.id);
        scene.nodes[node.id] = { cx: x + size.w / 2, cy: bounds.maxY + STRAGGLER_GAP + size.h / 2, w: size.w, h: size.h, role: "straggler" };
        x += size.w + STRAGGLER_GAP / 2;
    });
};

// Lanes draw their own headings, so a node that only names a lane is not a card. Cards that hung
// under one by parent take its name as their lane.
const withoutLaneHeadings = (model, structure) => {
    if (structure.family !== "lanes") return model;
    const fixed = new Set((structure.options?.fixed ?? []).map((name) => name.toLowerCase()));
    const headings = new Map(
        model.nodes.filter((node) => node.kind === "column" || fixed.has(node.label.trim().toLowerCase())).map((node) => [node.id, node.label]),
    );
    if (headings.size === 0 || headings.size === model.nodes.length) return model;
    const field = structure.options?.field ?? "lane";
    return {
        ...model,
        nodes: model.nodes
            .filter((node) => !headings.has(node.id))
            .map((node) => (headings.has(node.parent) && !node[field] ? { ...node, [field]: headings.get(node.parent), parent: null } : node)),
        edges: model.edges.filter((edge) => !headings.has(edge.from) && !headings.has(edge.to)),
    };
};

export const normalizeRecipe = (recipe = {}) => ({
    structure: structureFor(recipe.structure).id,
    look: lookFor(recipe.look ?? DEFAULT_LOOK_ID).id,
    levers: sanitizeLevers(recipe.levers),
});

// Lays out and paints a model. Elements come back around their own bounds;
// the caller moves them to wherever the diagram should land.
export const buildDiagram = ({
    model: rawModel,
    recipe: rawRecipe = {},
    metrics = estimatedTextMetrics,
    generateElementId,
    diagramId = generateElementId(),
}) => {
    const recipe = normalizeRecipe(rawRecipe);
    const style = resolveStyle(recipe);
    const { structure, look, levers } = style;
    const model = withoutLaneHeadings(normalizeDiagramModel(rawModel), structure);
    const familyId = LEVER_FAMILIES[levers.direction] ?? structure.family;
    const shapeOf = (node) => nodeShapeFor(node, { structure, levers, look, categoryIndex: model.nodes.indexOf(node) });
    const maxTextWidth = structure.family === "cards" ? 200 : structure.options?.notation === "er" || structure.options?.notation === "class" ? 260 : 220;
    const sizes = new Map(model.nodes.map((node) => [node.id, sizeNode(node, shapeOf(node), { levers, look, metrics, maxTextWidth })]));
    const gap = DENSITY_SCALE[levers.density]?.gap ?? 1;
    const scene = model.nodes.length
        ? FAMILIES[familyId]({ model, sizes, options: familyId === structure.family ? (structure.options ?? {}) : {}, levers, metrics, gap })
        : { nodes: {}, edges: [], groups: [], marks: [] };

    placeStragglers(scene, model, sizes);
    routeAroundNodes(scene);

    const out = [];
    const onBoardGround = !look.palette.ground && levers.ground !== "dark" && levers.ground !== "paper";
    const font = fontFor(look, levers);
    const ctx = {
        model,
        scene,
        style,
        metrics,
        diagramId,
        recipe,
        out,
        onBoardGround,
        font,
        handFont: fontFor(look, { ...levers, type: "hand" }),
        newId: generateElementId,
        z: createZCounter(),
        shapeOf,
        categories: assignCategories(model, scene, levers),
        highlighted: look.palette.spotlight ? spotlitNodes(model) : new Set(),
        frameOfNode: new Map(),
        frameOfFrame: new Map(),
    };
    ctx.slotOf = ctx.categories.slotOf;
    const bounds = sceneBounds(scene);
    ctx.bounds = bounds;

    paintGround(ctx, bounds);
    paintGroups(ctx);
    paintMarks(ctx, { behind: true });
    const nodeElementIds = paintNodes(ctx);
    paintEdges(ctx, nodeElementIds);
    paintMarks(ctx, { behind: false });
    paintCallouts(ctx);
    paintLegend(ctx, bounds, ctx.categories);
    paintTitle(ctx, bounds);

    const frameOf = new Map([...ctx.frameOfNode].map(([nodeId, frameId]) => [nodeElementIds.get(nodeId), frameId]));
    ctx.frameOfFrame.forEach((parent, child) => frameOf.set(child, parent));
    const elements = out.map(({ elementId, element }) => ({
        elementId,
        element: frameOf.has(elementId) ? { ...element, frameId: frameOf.get(elementId) } : element,
    }));
    return { elements, bounds: getUnionBounds(elements.map(({ element }) => element)), recipe, diagramId };
};

// Moves built elements so their bounds centre on (x, y).
export const centreDiagramOn = (built, x, y) => {
    const { bounds } = built;
    if (!bounds) return built.elements;
    const dx = x - (bounds.minX + bounds.maxX) / 2;
    const dy = y - (bounds.minY + bounds.maxY) / 2;
    return built.elements.map(({ elementId, element }) => ({ elementId, element: translateElement(element, dx, dy) }));
};

export { readDiagram, restyleDiagram } from "./restyle.js";
