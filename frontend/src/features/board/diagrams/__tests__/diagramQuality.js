// Pure checks over a generated diagram's elements, used by the fuzz tests as
// invariants: nothing overlaps, no line runs through a box, no label is cut.

import { boundsIntersect } from "../../../../../../shared/canvas/geometry/bounds";
import { getElementBounds } from "../../../../../../shared/canvas/geometry/bounds.js";
import { resolveConnectorPolyline } from "../../../../../../shared/canvas/elements/connectors";
import { MENU_ITEMS } from "../../tools/toolSettings";
import { estimatedTextMetrics, LABEL_LINE_HEIGHT } from "../layoutEngine";

const EDGE_TOLERANCE = 2;

const shrink = (b, by) => ({ minX: b.minX + by, minY: b.minY + by, maxX: b.maxX - by, maxY: b.maxY - by });

const pointInBox = (x, y, b) => x > b.minX && x < b.maxX && y > b.minY && y < b.maxY;

const segmentsCross = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return d1 * d2 < 0 && d3 * d4 < 0;
};

const segmentHitsBox = (x1, y1, x2, y2, box) => {
    if (pointInBox(x1, y1, box) || pointInBox(x2, y2, box)) return true;
    const { minX, minY, maxX, maxY } = box;
    return (
        segmentsCross(x1, y1, x2, y2, minX, minY, maxX, minY) ||
        segmentsCross(x1, y1, x2, y2, maxX, minY, maxX, maxY) ||
        segmentsCross(x1, y1, x2, y2, maxX, maxY, minX, maxY) ||
        segmentsCross(x1, y1, x2, y2, minX, maxY, minX, minY)
    );
};

const textBounds = (text, metrics = estimatedTextMetrics) => {
    const fontSize = text.size || 16;
    const width = text.width || 200;
    const height = metrics.lineCount(text.text, width, fontSize) * fontSize * LABEL_LINE_HEIGHT;
    return { minX: text.x, minY: text.y, maxX: text.x + width, maxY: text.y + height };
};

// Whether a text box fits inside the shape's own outline, which for an ellipse or diamond is tighter than its box.
const fitsInsideShape = (inner, shape) => {
    const outer = getElementBounds(shape);
    const cx = (outer.minX + outer.maxX) / 2;
    const cy = (outer.minY + outer.maxY) / 2;
    const a = (outer.maxX - outer.minX) / 2;
    const b = (outer.maxY - outer.minY) / 2;
    const corners = [
        [inner.minX, inner.minY],
        [inner.maxX, inner.minY],
        [inner.minX, inner.maxY],
        [inner.maxX, inner.maxY],
    ];
    if (shape.shapeType === MENU_ITEMS.ELLIPSE) {
        return corners.every(([x, y]) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1.0001);
    }
    if (shape.shapeType === MENU_ITEMS.DIAMOND) {
        return corners.every(([x, y]) => Math.abs(x - cx) / a + Math.abs(y - cy) / b <= 1.0001);
    }
    return inner.minX >= outer.minX - 1 && inner.maxX <= outer.maxX + 1 && inner.minY >= outer.minY - 1 && inner.maxY <= outer.maxY + 1;
};

const labelOwner = (text, shapes, metrics) => {
    const b = textBounds(text, metrics);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    return shapes.find(([, shape]) => pointInBox(cx, cy, getElementBounds(shape)));
};

// `occupied` is the content already on the board; labels are judged at the size the layout measured.
// Returns [{ rule, ids }], empty for a diagram with no problems.
export const findDiagramProblems = (elements, { occupied = [], textMetrics = estimatedTextMetrics } = {}) => {
    const problems = [];
    const entries = Object.entries(elements);
    const shapes = entries.filter(([, e]) => e.type === "shape");
    const texts = entries.filter(([, e]) => e.type === "text");
    const connectors = entries.filter(([, e]) => e.type === "connector");

    for (let i = 0; i < shapes.length; i += 1) {
        for (let j = i + 1; j < shapes.length; j += 1) {
            if (boundsIntersect(getElementBounds(shapes[i][1]), getElementBounds(shapes[j][1]))) {
                problems.push({ rule: "node-overlap", ids: [shapes[i][0], shapes[j][0]] });
            }
        }
    }

    const edgeLabels = [];
    texts.forEach(([id, text]) => {
        const owner = labelOwner(text, shapes, textMetrics);
        if (!owner) {
            edgeLabels.push([id, text]);
            return;
        }
        if (!fitsInsideShape(textBounds(text, textMetrics), owner[1])) problems.push({ rule: "label-overflow", ids: [id, owner[0]] });
    });

    connectors.forEach(([id, connector]) => {
        const points = resolveConnectorPolyline(connector, elements);
        shapes.forEach(([shapeId, shape]) => {
            if (shapeId === connector.startElementId || shapeId === connector.endElementId) return;
            const box = shrink(getElementBounds(shape), EDGE_TOLERANCE);
            for (let k = 0; k < points.length - 1; k += 1) {
                if (segmentHitsBox(points[k].x, points[k].y, points[k + 1].x, points[k + 1].y, box)) {
                    problems.push({ rule: "connector-through-node", ids: [id, shapeId] });
                    return;
                }
            }
        });
    });

    edgeLabels.forEach(([id, text]) => {
        const b = textBounds(text, textMetrics);
        shapes.forEach(([shapeId, shape]) => {
            if (boundsIntersect(shrink(b, 1), getElementBounds(shape))) problems.push({ rule: "edge-label-on-node", ids: [id, shapeId] });
        });
    });

    if (occupied.length > 0) {
        entries.forEach(([id, element]) => {
            const b = element.type === "text" ? textBounds(element, textMetrics) : getElementBounds(element);
            if (b && occupied.some((o) => boundsIntersect(b, o))) problems.push({ rule: "covers-existing-content", ids: [id] });
        });
    }

    return problems;
};
