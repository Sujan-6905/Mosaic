import { boundsCenter, getElementBounds, getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";

const EDGES_PER_NODE = 2;

export const REMOVED_MODULE_COLOR = "#ef4444";
const REMOVED_MODULE_OPACITY = 55;

const edgeModuleId = (edge) => `${edge.from}->${edge.to}`;

// The analysis marks which links are worth drawing: a link implied by a path
// through others stays in the graph for comparisons but not on the diagram.
export const pickDiagramEdges = (graph) => graph.edges.filter((edge) => edge.primary !== false);

const moduleBoxes = (elements) => {
    const boxes = new Map();
    for (const [elementId, element] of Object.entries(elements)) {
        if (element.type === "shape" && element.moduleId) boxes.set(element.moduleId, { elementId, element });
    }
    return boxes;
};

const moduleConnectors = (elements) => Object.entries(elements).filter(([, element]) => element.type === "connector" && element.moduleId);

const markedAsRemoved = (element) => ({ ...element, color: REMOVED_MODULE_COLOR, colorToken: null, opacity: REMOVED_MODULE_OPACITY });

// What a sync changes while keeping what someone arranged: new modules come back as a graph to place,
// new links as connectors, and anything gone is marked, never deleted or renamed.
export const planDiagramSync = (elements, graph) => {
    const boxes = moduleBoxes(elements);
    const liveNodeIds = new Set(graph.nodes.map((node) => node.id));
    const diagramEdges = pickDiagramEdges(graph);
    const liveEdgeIds = new Set(diagramEdges.map(edgeModuleId));
    const updates = {};

    const removedElementIds = [];
    for (const [moduleId, { elementId, element }] of boxes) {
        if (liveNodeIds.has(moduleId)) continue;
        updates[elementId] = markedAsRemoved(element);
        removedElementIds.push(elementId);
    }
    const connectors = moduleConnectors(elements);
    for (const [elementId, element] of connectors) {
        if (liveEdgeIds.has(element.moduleId)) continue;
        updates[elementId] = markedAsRemoved(element);
        removedElementIds.push(elementId);
    }

    const newNodes = graph.nodes.filter((node) => !boxes.has(node.id));
    const newNodeIds = new Set(newNodes.map((node) => node.id));
    const connectedIds = new Set(connectors.map(([, element]) => element.moduleId));
    const missingEdges = diagramEdges.filter((edge) => !connectedIds.has(edgeModuleId(edge)));

    return {
        updates,
        removedElementIds,
        newNodes,
        newInternalEdges: missingEdges.filter((edge) => newNodeIds.has(edge.from) && newNodeIds.has(edge.to)),
        crossEdges: missingEdges.filter((edge) => !newNodeIds.has(edge.from) || !newNodeIds.has(edge.to)),
    };
};

// A connector joining two boxes, for a link that appears after the diagram was placed.
export const buildConnectorBetween = ({ edge, startElementId, endElementId, startElement, endElement, color, zIndex }) => {
    const start = boundsCenter(getElementBounds(startElement));
    const end = boundsCenter(getElementBounds(endElement));
    return {
        type: "connector",
        moduleId: edgeModuleId(edge),
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
        startElementId,
        endElementId,
        waypoints: null,
        routing: "straight",
        color,
        size: 1.5,
        opacity: 100,
        arrowStart: false,
        arrowEnd: true,
        zIndex,
        rotation: 0,
        groupId: null,
        frameId: null,
        locked: false,
    };
};

export const findModuleBoxId = (elements, moduleId) => moduleBoxes(elements).get(moduleId)?.elementId ?? null;

export const describeSyncResult = ({ addedCount, removedCount, unchanged }) => {
    if (addedCount === 0 && removedCount === 0) return unchanged ? "Already up to date." : "The code changed, but the structure didn't.";
    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} new module${addedCount === 1 ? "" : "s"} added`);
    if (removedCount > 0) parts.push(`${removedCount} removed item${removedCount === 1 ? "" : "s"} marked in red`);
    return `${parts.join(", ")}. Your layout stayed as it was.`;
};

const edgeBounds = (edge, boxes) => {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) return null;
    return getUnionBounds([from.element, to.element]);
};

// Lays a comparison over the diagram as rows that can point at the board. A
// module the diagram doesn't have yet has no place to point at, so it's only listed.
export const comparisonToChanges = (diff, elements, labelFor = (node) => node.label) => {
    const boxes = moduleBoxes(elements);
    const nodeChange = (kind) => (node) => ({
        id: `${kind}:${node.id}`,
        kind,
        name: boxes.has(node.id) ? (labelOfBox(elements, node.id) ?? labelFor(node)) : labelFor(node),
        bounds: boxes.has(node.id) ? getElementBounds(boxes.get(node.id).element) : null,
    });
    const nameOfEnd = (moduleId) => labelOfBox(elements, moduleId) ?? moduleId.replace(/^service:/, "");
    const edgeChange = (kind) => (edge) => ({
        id: `${kind}:${edge.from}->${edge.to}`,
        kind,
        name: `link from ${nameOfEnd(edge.from)} to ${nameOfEnd(edge.to)}`,
        bounds: edgeBounds(edge, boxes),
    });
    return [
        ...diff.addedNodes.map(nodeChange("added")),
        ...diff.changedNodes.map(nodeChange("edited")),
        ...diff.removedNodes.map(nodeChange("removed")),
        ...diff.addedEdges.map(edgeChange("added")),
        ...diff.removedEdges.map(edgeChange("removed")),
    ];
};

const labelOfBox = (elements, moduleId) =>
    Object.values(elements).find((element) => element.moduleId === moduleId && element.type !== "connector" && element.text)?.text ?? null;
