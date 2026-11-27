import { getElementBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { describeStroke } from "../../../../../shared/canvas/strokes/shapeRecognizer.js";
import { generateEditElementId, nextZIndex } from "./common.js";

const ARROW_ATTACH_MARGIN_PX = 48;
const ARROWHEAD_REACH_PX = 56;
const ARROWHEAD_MAX_SHARE_OF_ARROW = 0.35;

const strokeLength = (bounds) => Math.hypot(bounds.endX - bounds.startX, bounds.endY - bounds.startY);

const shapeContaining = (shapes, point, excludeId = null) => {
    let best = null;
    let bestArea = Infinity;
    for (const [id, bounds] of shapes) {
        if (id === excludeId) continue;
        const near =
            point.x >= bounds.minX - ARROW_ATTACH_MARGIN_PX &&
            point.x <= bounds.maxX + ARROW_ATTACH_MARGIN_PX &&
            point.y >= bounds.minY - ARROW_ATTACH_MARGIN_PX &&
            point.y <= bounds.maxY + ARROW_ATTACH_MARGIN_PX;
        const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
        if (near && area < bestArea) {
            best = id;
            bestArea = area;
        }
    }
    return best;
};

// Recognisable strokes become the clean shapes they were drawn as, in place. A straight
// stroke between two shapes becomes a bound connector and takes its arrowhead strokes with it.
export const executeCleanUp = (elements, groupIndex, op) => {
    const strokeIds = [...new Set(op.refs.flatMap((ref) => groupIndex.elementIdsForRef(ref)))].filter((id) => elements[id]?.type === "path");
    if (strokeIds.length === 0) return { error: "cleanUp found no hand-drawn strokes in those refs" };

    const described = strokeIds.map((id) => ({ id, element: elements[id], stroke: describeStroke(elements[id].points) })).filter(({ stroke }) => stroke);
    const newElementsById = {};
    const deletedIds = new Set();
    let zIndex = nextZIndex(elements);

    const shapes = new Map(
        Object.entries(elements)
            .filter(([, element]) => element.type === "shape")
            .map(([id, element]) => [id, getElementBounds(element)]),
    );

    described
        .filter(({ stroke }) => stroke.kind === "closed")
        .forEach(({ id, element, stroke }) => {
            const newId = generateEditElementId();
            const shape = {
                type: "shape",
                shapeType: stroke.shapeType,
                ...stroke.bounds,
                color: element.color,
                colorToken: element.colorToken ?? null,
                fillColor: null,
                size: Math.max(2, Math.min(element.size ?? 2, 4)),
                opacity: element.opacity ?? 100,
                zIndex: element.zIndex,
                rotation: 0,
                groupId: element.groupId ?? null,
                frameId: element.frameId ?? null,
            };
            newElementsById[newId] = shape;
            deletedIds.add(id);
            shapes.set(newId, getElementBounds(shape));
        });

    const lines = described.filter(({ stroke }) => stroke.kind === "line");
    const longestFirst = [...lines].sort((a, b) => strokeLength(b.stroke.bounds) - strokeLength(a.stroke.bounds));

    longestFirst.forEach(({ id, element, stroke }) => {
        if (deletedIds.has(id)) return;
        const startShape = shapeContaining(shapes, stroke.start);
        const endShape = shapeContaining(shapes, stroke.end, startShape);
        const isConnector = startShape && endShape;
        const newId = generateEditElementId();
        zIndex += 1;
        newElementsById[newId] = isConnector
            ? {
                  type: "connector",
                  startX: stroke.start.x,
                  startY: stroke.start.y,
                  endX: stroke.end.x,
                  endY: stroke.end.y,
                  startElementId: startShape,
                  endElementId: endShape,
                  color: element.color,
                  colorToken: element.colorToken ?? null,
                  size: 2,
                  opacity: element.opacity ?? 100,
                  arrowStart: false,
                  arrowEnd: true,
                  zIndex,
                  rotation: 0,
              }
            : {
                  type: "shape",
                  shapeType: "Line",
                  startX: stroke.start.x,
                  startY: stroke.start.y,
                  endX: stroke.end.x,
                  endY: stroke.end.y,
                  color: element.color,
                  colorToken: element.colorToken ?? null,
                  fillColor: null,
                  size: 2,
                  opacity: element.opacity ?? 100,
                  zIndex,
                  rotation: 0,
              };
        deletedIds.add(id);
        if (!isConnector) return;

        const arrowLength = strokeLength(stroke.bounds);
        described.forEach((candidate) => {
            if (deletedIds.has(candidate.id) || candidate.stroke.kind === "closed") return;
            const { bounds } = candidate.stroke;
            const isShort = strokeLength(bounds) <= arrowLength * ARROWHEAD_MAX_SHARE_OF_ARROW;
            const centerX = (bounds.startX + bounds.endX) / 2;
            const centerY = (bounds.startY + bounds.endY) / 2;
            if (isShort && Math.hypot(centerX - stroke.end.x, centerY - stroke.end.y) <= ARROWHEAD_REACH_PX) deletedIds.add(candidate.id);
        });
    });

    if (Object.keys(newElementsById).length === 0) return { error: "none of those strokes look like a recognisable shape" };
    return { newElementsById, deletedIds: [...deletedIds] };
};
