// Recognises a clean shape in a freehand stroke on pen-up, with classical geometry only.

// Values match the client's MENU_ITEMS so a result drops straight into a
// `type: "shape"` element.
const SHAPE_TYPES = { LINE: "Line", RECTANGLE: "Rectangle", TRIANGLE: "Triangle", CIRCLE: "Circle", ELLIPSE: "Ellipse", DIAMOND: "Diamond" };

const MIN_POINTS = 6;
// Scores just past a detector's own cutoff are noise, not a confident read.
const MIN_CONFIDENCE = 0.5;

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const pathLength = (points) => {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
    return total;
};

// Falls back to point-to-point distance when the baseline is ~0 long, so a
// closed loop's near-duplicate start/end doesn't divide by zero.
const perpendicularDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLengthSq = dx * dx + dy * dy;
    if (lineLengthSq < 1e-9) return distance(point, lineStart);
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq;
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
};

// Ramer-Douglas-Peucker: collapses a point series to its structural corners.
const rdpSimplify = (points, epsilon) => {
    if (points.length < 3) return points.slice();
    let maxDist = 0;
    let splitIndex = 0;
    const last = points.length - 1;
    for (let i = 1; i < last; i++) {
        const d = perpendicularDistance(points[i], points[0], points[last]);
        if (d > maxDist) {
            maxDist = d;
            splitIndex = i;
        }
    }
    if (maxDist <= epsilon) return [points[0], points[last]];
    const left = rdpSimplify(points.slice(0, splitIndex + 1), epsilon);
    const right = rdpSimplify(points.slice(splitIndex), epsilon);
    return left.slice(0, -1).concat(right);
};

const boundingBox = (points) => {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
};

const toBounds = (box) => ({ startX: box.minX, startY: box.minY, endX: box.maxX, endY: box.maxY });

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const detectLine = (points, first, last, length) => {
    const chordLength = distance(first, last);
    // A closed loop's endpoints sit close together relative to the path it
    // took to get there: that's the signal we're NOT looking at a line.
    if (chordLength < length * 0.5) return null;
    let maxDeviation = 0;
    for (const point of points) {
        const deviation = perpendicularDistance(point, first, last);
        if (deviation > maxDeviation) maxDeviation = deviation;
    }
    const threshold = chordLength * 0.06;
    if (maxDeviation > threshold) return null;
    return {
        shapeType: SHAPE_TYPES.LINE,
        confidence: clamp01(1 - maxDeviation / threshold),
        bounds: { startX: first.x, startY: first.y, endX: last.x, endY: last.y },
    };
};

// Interior angle at `corner`, formed by its two polygon neighbors, in degrees.
const angleAtCorner = (prev, corner, next) => {
    const v1x = prev.x - corner.x;
    const v1y = prev.y - corner.y;
    const v2x = next.x - corner.x;
    const v2y = next.y - corner.y;
    const magnitude = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (magnitude < 1e-9) return 0;
    const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / magnitude));
    return (Math.acos(cos) * 180) / Math.PI;
};

const detectPolygon = (points, length, box) => {
    const epsilon = Math.max(length * 0.02, 4);
    const simplified = rdpSimplify(points, epsilon);

    // The closing gap is already within tolerance, so the ends count as one corner.
    const closingGap = distance(simplified[0], simplified[simplified.length - 1]);
    const corners = closingGap < length * 0.05 ? simplified.slice(0, -1) : simplified;

    if (corners.length !== 3 && corners.length !== 4) return null;

    const angles = corners.map((corner, i) => {
        const prev = corners[(i - 1 + corners.length) % corners.length];
        const next = corners[(i + 1) % corners.length];
        return angleAtCorner(prev, corner, next);
    });

    if (corners.length === 4) {
        const maxDeviation = Math.max(...angles.map((a) => Math.abs(a - 90)));
        if (maxDeviation > 30) return null;
        return {
            shapeType: SHAPE_TYPES.RECTANGLE,
            confidence: clamp01(1 - maxDeviation / 30),
            bounds: toBounds(box),
        };
    }

    // A near-straight corner means a squashed shape, not a triangle.
    const flattestCorner = Math.min(...angles.map((a) => Math.abs(180 - a)));
    if (flattestCorner < 15) return null;
    return {
        shapeType: SHAPE_TYPES.TRIANGLE,
        confidence: clamp01(flattestCorner / 60),
        bounds: toBounds(box),
    };
};

const detectRoundShape = (points, box) => {
    const radiusX = (box.maxX - box.minX) / 2;
    const radiusY = (box.maxY - box.minY) / 2;
    if (radiusX < 1e-6 || radiusY < 1e-6) return null;

    const centerX = box.minX + radiusX;
    const centerY = box.minY + radiusY;

    // Normalising by the half-widths first lets an ellipse read as low variance like a circle.
    const normalizedRadii = points.map((p) => Math.hypot((p.x - centerX) / radiusX, (p.y - centerY) / radiusY));
    const meanRadius = normalizedRadii.reduce((sum, r) => sum + r, 0) / normalizedRadii.length;
    if (meanRadius < 1e-6) return null;

    const variance = normalizedRadii.reduce((sum, r) => sum + (r - meanRadius) ** 2, 0) / normalizedRadii.length;
    const coefficientOfVariation = Math.sqrt(variance) / meanRadius;
    const maxCoefficientOfVariation = 0.25;
    if (coefficientOfVariation > maxCoefficientOfVariation) return null;

    const larger = Math.max(radiusX, radiusY);
    const smaller = Math.min(radiusX, radiusY);
    const isCircle = smaller / larger >= 0.8;

    return {
        shapeType: isCircle ? SHAPE_TYPES.CIRCLE : SHAPE_TYPES.ELLIPSE,
        confidence: clamp01(1 - coefficientOfVariation / maxCoefficientOfVariation),
        bounds: toBounds(box),
    };
};

// { shapeType, confidence, bounds } for a confident match, or null to leave the stroke as drawn.
export const classifyStroke = (points) => {
    if (!Array.isArray(points) || points.length < MIN_POINTS) return null;

    const length = pathLength(points);
    if (length < 1e-6) return null;

    const box = boundingBox(points);
    if (Math.max(box.maxX - box.minX, box.maxY - box.minY) < 10) return null;

    const first = points[0];
    const last = points[points.length - 1];

    const line = detectLine(points, first, last, length);
    if (line && line.confidence >= MIN_CONFIDENCE) return line;

    const isClosed = distance(first, last) < length * 0.15;
    if (!isClosed) return null;

    const match = detectPolygon(points, length, box) || detectRoundShape(points, box);
    return match && match.confidence >= MIN_CONFIDENCE ? match : null;
};

const MAX_ROUGH_POINTS = 240;
const downsample = (points) => {
    if (points.length <= MAX_ROUGH_POINTS) return points;
    const step = points.length / MAX_ROUGH_POINTS;
    return Array.from({ length: MAX_ROUGH_POINTS }, (_, i) => points[Math.floor(i * step)]);
};

// A corner-cut box whose corners sit near the middles of its bounding box's
// sides, rather than near that box's own corners.
const looksLikeDiamond = (points, box) => {
    const centerX = (box.minX + box.maxX) / 2;
    const centerY = (box.minY + box.maxY) / 2;
    const halfWidth = (box.maxX - box.minX) / 2 || 1;
    const halfHeight = (box.maxY - box.minY) / 2 || 1;
    const manhattan = points.map((p) => Math.abs(p.x - centerX) / halfWidth + Math.abs(p.y - centerY) / halfHeight);
    return manhattan.reduce((sum, value) => sum + value, 0) / manhattan.length < 1.15;
};

// A hand-drawn box reaches its bounding box's corners, however wobbly its sides
// are, while an ellipse of the same size stays well clear of them.
const reachesCorners = (points, box) => {
    const width = box.maxX - box.minX || 1;
    const height = box.maxY - box.minY || 1;
    const corners = [
        [box.minX, box.minY],
        [box.maxX, box.minY],
        [box.maxX, box.maxY],
        [box.minX, box.maxY],
    ];
    const reached = corners.filter(([x, y]) => points.some((p) => Math.abs(p.x - x) / width < 0.2 && Math.abs(p.y - y) / height < 0.2));
    return reached.length >= 3;
};

// Always names a real stroke: unlike classifyStroke it only informs an edit someone asked
// for, so it tolerates gaps, tails and wobble.
export const describeStroke = (rawPoints) => {
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) return null;
    const points = downsample(rawPoints);
    const length = pathLength(points);
    const box = boundingBox(points);
    const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
    if (length < 1e-6 || span < 4) return { kind: "dot", bounds: toBounds(box) };

    const first = points[0];
    const last = points[points.length - 1];
    const exact = classifyStroke(points);
    if (exact?.shapeType === SHAPE_TYPES.LINE) return { kind: "line", shapeType: SHAPE_TYPES.LINE, start: first, end: last, bounds: toBounds(box) };

    const chord = distance(first, last);
    // Against the stroke's span as well as its length: a zigzag travels far
    // without its ends coming back together, so length alone calls it closed.
    const closed = chord < length * 0.3 && chord < span * 0.35;
    if (!closed) {
        const straightish = chord > length * 0.75;
        return { kind: straightish ? "line" : "curve", shapeType: straightish ? SHAPE_TYPES.LINE : null, start: first, end: last, bounds: toBounds(box) };
    }

    const narrow = Math.min(box.maxX - box.minX, box.maxY - box.minY) < span * 0.12;
    if (narrow) return { kind: "scribble", shapeType: null, bounds: toBounds(box) };

    // Diamond first: a diamond is a rotated rectangle to the strict recogniser.
    const shapeType = looksLikeDiamond(points, box)
        ? SHAPE_TYPES.DIAMOND
        : (exact?.shapeType ?? (reachesCorners(points, box) ? SHAPE_TYPES.RECTANGLE : (detectRoundShape(points, box)?.shapeType ?? SHAPE_TYPES.RECTANGLE)));
    return { kind: "closed", shapeType, bounds: toBounds(box) };
};

export { rdpSimplify, pathLength };
