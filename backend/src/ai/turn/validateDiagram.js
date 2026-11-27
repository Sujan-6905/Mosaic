const VALID_NODE_SHAPES = new Set(["box", "ellipse", "diamond"]);
const MAX_NODES = 30;
const MAX_EDGES = 60;
const MAX_LABEL_LENGTH = 120;
const MAX_GROUPS = 20;

const isNonEmptyString = (value, maxLength) => typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

// { valid: true, nodes, edges } or { valid: false, error }, never throwing. The model never emits
// geometry; the client lays the graph out.
const validateDiagram = (rawContent) => {
    try {
        return validateGraph(JSON.parse(rawContent));
    } catch (error) {
        return { valid: false, error: "Response was not valid JSON." };
    }
};

const HEX_FILL = /^#[0-9a-f]{6}$/i;

const validateGraph = (parsed) => {
    if (!parsed || !Array.isArray(parsed.nodes)) {
        return { valid: false, error: 'Response must be a JSON object with a "nodes" array.' };
    }
    if (!Array.isArray(parsed.edges)) {
        return { valid: false, error: 'Response must be a JSON object with an "edges" array.' };
    }
    if (parsed.nodes.length === 0) {
        return { valid: false, error: "nodes array must not be empty." };
    }
    if (parsed.nodes.length > MAX_NODES) {
        return { valid: false, error: `Too many nodes (${parsed.nodes.length}); max is ${MAX_NODES}.` };
    }
    if (parsed.edges.length > MAX_EDGES) {
        return { valid: false, error: `Too many edges (${parsed.edges.length}); max is ${MAX_EDGES}.` };
    }

    const nodeIds = new Set();
    for (const [index, node] of parsed.nodes.entries()) {
        if (!node || typeof node !== "object") {
            return { valid: false, error: `Node ${index} is not an object.` };
        }
        if (!isNonEmptyString(node.id, 50)) {
            return { valid: false, error: `Node ${index} is missing a string "id".` };
        }
        if (nodeIds.has(node.id)) {
            return { valid: false, error: `Node id "${node.id}" is used more than once.` };
        }
        nodeIds.add(node.id);
        if (!isNonEmptyString(node.label, MAX_LABEL_LENGTH)) {
            return { valid: false, error: `Node "${node.id}" is missing a string "label".` };
        }
        if (node.shape !== undefined && !VALID_NODE_SHAPES.has(node.shape)) {
            return { valid: false, error: `Node "${node.id}" has invalid "shape": ${JSON.stringify(node.shape)}.` };
        }
        if (node.fillColor !== undefined && !HEX_FILL.test(node.fillColor)) {
            return { valid: false, error: `Node "${node.id}" has invalid "fillColor".` };
        }
    }

    for (const [index, edge] of parsed.edges.entries()) {
        if (!edge || typeof edge !== "object") {
            return { valid: false, error: `Edge ${index} is not an object.` };
        }
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
            return { valid: false, error: `Edge ${index} references a node id that isn't in "nodes".` };
        }
        if (edge.label !== undefined && !isNonEmptyString(edge.label, MAX_LABEL_LENGTH)) {
            return { valid: false, error: `Edge ${index} has an invalid "label".` };
        }
    }

    const groups = Array.isArray(parsed.groups) ? parsed.groups.filter((group) => group && isNonEmptyString(group.id, 50)).slice(0, MAX_GROUPS) : [];
    return { valid: true, nodes: parsed.nodes, edges: parsed.edges, groups };
};

export { validateGraph };
export default validateDiagram;
