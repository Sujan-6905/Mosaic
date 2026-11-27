// A repository's module graph drawn through the diagram style engine: one band per tier (each app, shared code,
// data stores, outside services), so it reads like an architecture and can be restyled like any other diagram.
// Every box and arrow keeps the module it stands for, which is what sync and comparisons match on.
import { buildStyledDiagram, centreDiagramOn } from "./diagramStyles";
import { pickDiagramEdges, sharedModuleIds } from "./architectureBoard";

const ARCHITECTURE_RECIPE = { structure: "layered-tiers", look: "blueprint", levers: {} };

const SHARED_TIER = "Shared code";
const DATA_TIER = "Data stores";
const EXTERNAL_TIER = "External services";
const GROUP_ORDER = { frontend: 0, backend: 1, library: 2 };
const QUEUE_SERVICES = /kafka|rabbitmq|queue/i;

const dropTrailingSlash = (title) => title.replace(/\/(?=\s|$)/g, "");

const tierOf = (node, groupLabels, shared) => {
    if (node.kind === "service") return node.serviceKind === "data" ? DATA_TIER : EXTERNAL_TIER;
    if (shared.has(node.id)) return SHARED_TIER;
    return groupLabels.get(node.group) ?? SHARED_TIER;
};

const kindOf = (node, groupKinds) => {
    if (node.kind === "service") {
        if (node.serviceKind === "data") return "database";
        return QUEUE_SERVICES.test(node.label) ? "queue" : "external";
    }
    return groupKinds.get(node.group) === "frontend" && node.layer === 0 ? "client" : null;
};

// The model's name and purpose when the assistant explained the graph, otherwise the folder and what it holds.
const wordsFor = (node) => {
    if (node.kind === "service") return { label: node.label, detail: null };
    if (node.description) return { label: node.label, detail: node.description };
    return { label: dropTrailingSlash(node.title ?? node.label), detail: node.subtitle || null };
};

const architectureModelOf = (graph, title = null) => {
    const groups = graph.groups ?? [];
    const groupLabels = new Map(groups.map((group) => [group.id, group.label]));
    const groupKinds = new Map(groups.map((group) => [group.id, group.kind]));
    const shared = sharedModuleIds(graph);
    const tierRank = new Map(
        [...groups]
            .sort((a, b) => (GROUP_ORDER[a.kind] ?? 3) - (GROUP_ORDER[b.kind] ?? 3))
            .map((group) => group.label)
            .concat([SHARED_TIER, DATA_TIER, EXTERNAL_TIER])
            .map((tier, index) => [tier, index]),
    );

    const nodes = graph.nodes
        .map((node) => ({ node, tier: tierOf(node, groupLabels, shared) }))
        .sort((a, b) => tierRank.get(a.tier) - tierRank.get(b.tier) || (a.node.layer ?? 0) - (b.node.layer ?? 0))
        .map(({ node, tier }, index) => ({ id: `m${index}`, moduleId: node.id, tier, kind: kindOf(node, groupKinds), ...wordsFor(node) }));
    const idOf = new Map(nodes.map((node) => [node.moduleId, node.id]));
    const edges = pickDiagramEdges(graph)
        .filter((edge) => idOf.has(edge.from) && idOf.has(edge.to))
        .map((edge) => ({ from: idOf.get(edge.from), to: idOf.get(edge.to), label: edge.label ?? null }));

    return {
        model: { title, nodes: nodes.map(({ moduleId, ...node }) => node), edges, groups: [] },
        moduleIdOf: new Map(nodes.map((node) => [node.id, node.moduleId])),
    };
};

const moduleIdFor = (diagram, moduleIdOf) => {
    if (diagram?.role === "node") return moduleIdOf.get(diagram.key) ?? null;
    if (diagram?.role !== "edge") return null;
    const [from, to] = diagram.key.replace(/:\d+$/, "").split("->");
    return moduleIdOf.has(from) && moduleIdOf.has(to) ? `${moduleIdOf.get(from)}->${moduleIdOf.get(to)}` : null;
};

export const buildArchitectureDiagram = ({ graph, title = null, generateElementId }) => {
    const { model, moduleIdOf } = architectureModelOf(graph, title);
    const built = buildStyledDiagram({ diagram: model, recipe: ARCHITECTURE_RECIPE, generateElementId });
    return centreDiagramOn(built, 0, 0).map(({ elementId, element }) => {
        const moduleId = moduleIdFor(element.diagram, moduleIdOf);
        return { elementId, element: moduleId ? { ...element, moduleId } : element };
    });
};
