// How a sketch's named parts become pen strokes, shared so a sketch placed by hand
// in the browser and one the assistant adds straight to the board are the same ink.

const STROKE_SIZE = 3;
const SAMPLES_PER_SEGMENT = 8;
const STRAIGHT_STEP_RATIO = 0.04;
const BOW_RATIO = 0.012;
const MAX_BOW_RATIO = 0.005;

// A stroke whose ends meet within this share of its own extent counts as closed.
const CLOSED_GAP_RATIO = 0.12;

const extentOf = (points) => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

export const endsMeet = (points) => {
    if (points.length < 3) return false;
    const [first, last] = [points[0], points[points.length - 1]];
    return Math.hypot(last.x - first.x, last.y - first.y) <= extentOf(points) * CLOSED_GAP_RATIO;
};

// Catmull-Rom through the points, because a polyline through a dozen coarse points
// reads as a technical plot rather than something drawn by hand.
const smoothStroke = (points, closed) => {
    const at = (i) => (closed ? points[(i + points.length) % points.length] : points[Math.max(0, Math.min(points.length - 1, i))]);
    const segmentCount = closed ? points.length : points.length - 1;
    const smoothed = [];
    for (let i = 0; i < segmentCount; i += 1) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        for (let step = 0; step < SAMPLES_PER_SEGMENT; step += 1) {
            const t = step / SAMPLES_PER_SEGMENT;
            const t2 = t * t;
            const t3 = t2 * t;
            smoothed.push({
                x: 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3),
                y: 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3),
            });
        }
    }
    smoothed.push(closed ? { ...points[0] } : { ...points[points.length - 1] });
    return smoothed;
};

// Straight sides keep their corners and bow very slightly, the way a hand-drawn
// line does. Derived from the geometry, so a preview and an insert match exactly.
const straightStroke = (points, closed, unit) => {
    const route = closed ? [...points, points[0]] : points;
    const drawn = [];
    route.slice(0, -1).forEach((from, index) => {
        const to = route[index + 1];
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.max(1, Math.round(length / (STRAIGHT_STEP_RATIO * unit)));
        const bow = (index % 2 === 0 ? 1 : -1) * Math.min(length * BOW_RATIO, MAX_BOW_RATIO * unit);
        const [normalX, normalY] = length > 0 ? [-(to.y - from.y) / length, (to.x - from.x) / length] : [0, 0];
        for (let step = 0; step < steps; step += 1) {
            const t = step / steps;
            const offset = bow * Math.sin(t * Math.PI);
            drawn.push({ x: from.x + (to.x - from.x) * t + normalX * offset, y: from.y + (to.y - from.y) * t + normalY * offset });
        }
    });
    drawn.push({ ...route[route.length - 1] });
    return drawn;
};

const inkLine = ({ points, closed, smooth }, unit) => (smooth ? smoothStroke(points, closed) : straightStroke(points, closed, unit));

// `unit` is a drawing's size in board coordinates, keeping the wobble in proportion. A closed
// shape takes the colour as fill; an open line takes it as ink.
export const sketchPartsToElements = ({ parts, toBoard, unit = 100, color, zIndexBase, generateElementId, sketchId, sketchTitle, extras = {} }) =>
    parts
        .flatMap((part) => part.strokes.map((stroke) => ({ stroke, name: part.name, fill: part.fill })))
        .map(({ stroke, name, fill }, index) => ({
            elementId: generateElementId(),
            element: {
                type: "path",
                points: inkLine(stroke, unit).map((point) => ({ ...toBoard(point), pressure: 0.5 })),
                color: fill && !stroke.closed ? fill : color,
                label: name,
                ...(fill && stroke.closed ? { fillColor: fill } : {}),
                ...(sketchId ? { sketchId } : {}),
                ...(sketchTitle ? { sketchTitle } : {}),
                size: STROKE_SIZE,
                opacity: 100,
                zIndex: zIndexBase + index + 1,
                rotation: 0,
                groupId: null,
                frameId: null,
                locked: false,
                ...extras,
                ...(fill && !stroke.closed ? { colorToken: null } : {}),
            },
        }));

// An assistant sketch, drawn in a 0 to 100 space, as ordinary pen strokes that edit like hand-drawn ones.
export const SKETCH_SIZE_PX = 420;
const SKETCH_SPACE = 100;

export const buildElementsFromSketch = ({ parts, title, targetCenterX, targetCenterY, color, zIndexBase, generateElementId, schemaVersionExtras = {} }) => {
    const scale = SKETCH_SIZE_PX / SKETCH_SPACE;
    const offsetX = targetCenterX - SKETCH_SIZE_PX / 2;
    const offsetY = targetCenterY - SKETCH_SIZE_PX / 2;

    return sketchPartsToElements({
        parts,
        toBoard: ({ x, y }) => ({ x: offsetX + x * scale, y: offsetY + y * scale }),
        unit: SKETCH_SPACE,
        color,
        zIndexBase,
        generateElementId,
        sketchId: generateElementId(),
        sketchTitle: title,
        extras: schemaVersionExtras,
    });
};
