import { elementSchema } from "../../../backend/src/validation/socketSchemas.js";
import { withConnectorHeads } from "../../../shared/canvas/elements/connectors.js";

// zIndex is set where the element is placed, from what is on the board then.
const sharedDefaults = () => ({
    zIndex: 0,
    rotation: 0,
    groupId: null,
    frameId: null,
    locked: false,
});

// The tool schema takes lowercase names; the canvas matches shapeType
// against its own capitalised tool names, so anything else draws nothing.
export const CANVAS_SHAPE_NAMES = {
    rectangle: "Rectangle",
    circle: "Circle",
    ellipse: "Ellipse",
    triangle: "Triangle",
    diamond: "Diamond",
    star: "Star",
    hexagon: "Hexagon",
    pentagon: "Pentagon",
    parallelogram: "Parallelogram",
    trapezoid: "Trapezoid",
    database: "Cylinder",
    document: "Document",
    cloud: "Cloud",
    callout: "Callout",
    block_arrow: "BlockArrow",
    plus: "Plus",
    arrow: "Arrow",
    line: "Line",
};

const BUILDERS = {
    path: (fields) => ({
        type: "path",
        color: "#000000",
        colorToken: null,
        size: 2,
        opacity: 100,
        ...sharedDefaults(),
        ...fields,
    }),
    shape: (fields) => ({
        type: "shape",
        color: "#000000",
        colorToken: null,
        fillColor: null,
        fillColorToken: null,
        size: 2,
        opacity: 100,
        ...sharedDefaults(),
        ...fields,
        shapeType: CANVAS_SHAPE_NAMES[fields.shapeType] ?? fields.shapeType,
    }),
    text: (fields) => ({
        type: "text",
        color: "#000000",
        colorToken: null,
        size: 16,
        ...sharedDefaults(),
        ...fields,
    }),
    sticky: (fields) => ({
        type: "sticky",
        color: "#000000",
        colorToken: null,
        fillColor: "#fef08a",
        fillColorToken: null,
        size: 16,
        ...sharedDefaults(),
        ...fields,
    }),
    frame: (fields) => ({
        type: "frame",
        color: "#000000",
        colorToken: null,
        ...sharedDefaults(),
        ...fields,
    }),
    connector: (fields) => ({
        type: "connector",
        color: "#000000",
        colorToken: null,
        size: 2,
        opacity: 100,
        arrowStart: false,
        arrowEnd: true,
        startElementId: null,
        endElementId: null,
        ...sharedDefaults(),
        ...withConnectorHeads(fields),
    }),
    image: (fields) => ({
        type: "image",
        opacity: 100,
        ...sharedDefaults(),
        ...fields,
    }),
};

const describeIssues = (error) => error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");

// Fills in drawing defaults and validates against the backend's own element schema, so a
// malformed element fails here with a message instead of being silently dropped.
export const buildElement = (type, fields) => {
    const builder = BUILDERS[type];
    if (!builder) {
        throw new Error(`Unknown element type "${type}". Expected one of: ${Object.keys(BUILDERS).join(", ")}`);
    }
    const element = builder(fields);
    const result = elementSchema.safeParse(element);
    if (!result.success) {
        throw new Error(`Invalid ${type} element: ${describeIssues(result.error)}`);
    }
    return result.data;
};

// Validates a patch merged onto the live element, so a partial invalid patch never reaches the server.
export const applyPatch = (existing, patch) => {
    const merged = { ...existing, ...patch };
    const result = elementSchema.safeParse(merged);
    if (!result.success) {
        throw new Error(`Invalid update: ${describeIssues(result.error)}`);
    }
    return result.data;
};
