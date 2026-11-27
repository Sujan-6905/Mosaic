import { elementSchema } from "../../backend/src/validation/socketSchemas.js";

// Containers, layers and lanes hold other boxes by design, so only leaf boxes count towards overlap.
const ENCLOSING_ROLES = new Set(["container", "layer", "segment", "row", "category", "header", "title", "ground"]);

const isLabelledBox = (element) =>
    element.type === "shape" && Boolean(element.text) && !["Line", "Arrow"].includes(element.shapeType) && !ENCLOSING_ROLES.has(element.diagram?.role);

const boxOf = (element) => [
    Math.min(element.startX, element.endX),
    Math.min(element.startY, element.endY),
    Math.max(element.startX, element.endX),
    Math.max(element.startY, element.endY),
];

const overlaps = ([ax1, ay1, ax2, ay2], [bx1, by1, bx2, by2]) => ax1 < bx2 && bx1 < ax2 && ay1 < by2 && by1 < ay2;

const wordsOn = (elements) =>
    elements
        .map((element) => element.text ?? "")
        .join(" ")
        .toLowerCase();

// Structural measures only; whether a drawing looks like its subject is left to the images.
export const gradeResult = (task, result) => {
    const elements = Object.values(result.elements);
    const boxes = elements.filter(isLabelledBox).map(boxOf);
    const overlapping = boxes.reduce((count, box, index) => count + boxes.slice(index + 1).filter((other) => overlaps(box, other)).length, 0);
    const words = wordsOn(elements);
    const covered = task.expect?.filter((term) => words.includes(term)) ?? [];
    return {
        drawn: result.outcome === "drawn",
        elementCount: elements.length,
        validShare: elements.length === 0 ? 0 : elements.filter((element) => elementSchema.safeParse(element).success).length / elements.length,
        coverage: task.expect ? covered.length / task.expect.length : null,
        missing: task.expect ? task.expect.filter((term) => !covered.includes(term)) : [],
        overlappingLabels: overlapping,
        connectors: elements.filter((element) => element.type === "connector" || element.shapeType === "Arrow").length,
    };
};
