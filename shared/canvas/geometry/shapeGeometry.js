// Every shape's outline, kept inside its start/end box. A trace only calls moveTo, lineTo,
// the two curve calls and closePath, so it can drive a canvas, an SVG path or a sampler.

const ELLIPSE_KAPPA = 0.5522847498;
const CURVE_SAMPLES = 10;

const normalizePolygon = (points) => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const height = Math.max(...ys) - minY;
    return points.map(([x, y]) => [(x - minX) / width, (y - minY) / height]);
};

const regularPolygon = (sides) =>
    normalizePolygon(
        Array.from({ length: sides }, (_, i) => {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            return [Math.cos(angle), Math.sin(angle)];
        }),
    );

const STAR_INNER_RATIO = 0.5;
const STAR = normalizePolygon(
    Array.from({ length: 10 }, (_, i) => {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? 1 : STAR_INNER_RATIO;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
    }),
);

const POLYGONS = {
    Triangle: [
        [0.5, 0],
        [1, 1],
        [0, 1],
    ],
    Diamond: [
        [0.5, 0],
        [1, 0.5],
        [0.5, 1],
        [0, 0.5],
    ],
    Star: STAR,
    Hexagon: [
        [0.25, 0],
        [0.75, 0],
        [1, 0.5],
        [0.75, 1],
        [0.25, 1],
        [0, 0.5],
    ],
    Pentagon: regularPolygon(5),
    Parallelogram: [
        [0.2, 0],
        [1, 0],
        [0.8, 1],
        [0, 1],
    ],
    Trapezoid: [
        [0.2, 0],
        [0.8, 0],
        [1, 1],
        [0, 1],
    ],
    BlockArrow: [
        [0, 0.25],
        [0.6, 0.25],
        [0.6, 0],
        [1, 0.5],
        [0.6, 1],
        [0.6, 0.75],
        [0, 0.75],
    ],
    Plus: [
        [0.33, 0],
        [0.67, 0],
        [0.67, 0.33],
        [1, 0.33],
        [1, 0.67],
        [0.67, 0.67],
        [0.67, 1],
        [0.33, 1],
        [0.33, 0.67],
        [0, 0.67],
        [0, 0.33],
        [0.33, 0.33],
    ],
};

// Fraction of the box left clear on each side for a shape's own text.
const TEXT_INSETS = {
    Circle: 0.15,
    Ellipse: 0.15,
    Diamond: 0.25,
    Triangle: 0.25,
    Star: 0.3,
    Hexagon: 0.12,
    Pentagon: 0.15,
    Parallelogram: 0.15,
    Trapezoid: 0.15,
    BlockArrow: 0.12,
    Plus: 0.3,
    Cloud: 0.18,
};

const OPEN_SHAPE_TYPES = ["Line", "Arrow"];

const mapper = (element) => {
    const { startX, startY, endX, endY } = element;
    return (u, v) => [startX + u * (endX - startX), startY + v * (endY - startY)];
};

const traceEllipse = (sink, at) => {
    const k = ELLIPSE_KAPPA / 2;
    sink.moveTo(...at(0.5, 0));
    sink.bezierCurveTo(...at(0.5 + k, 0), ...at(1, 0.5 - k), ...at(1, 0.5));
    sink.bezierCurveTo(...at(1, 0.5 + k), ...at(0.5 + k, 1), ...at(0.5, 1));
    sink.bezierCurveTo(...at(0.5 - k, 1), ...at(0, 0.5 + k), ...at(0, 0.5));
    sink.bezierCurveTo(...at(0, 0.5 - k), ...at(0.5 - k, 0), ...at(0.5, 0));
    sink.closePath();
};

const traceRectangle = (sink, element) => {
    const minX = Math.min(element.startX, element.endX);
    const minY = Math.min(element.startY, element.endY);
    const maxX = Math.max(element.startX, element.endX);
    const maxY = Math.max(element.startY, element.endY);
    const radius = Math.min(element.cornerRadius || 0, (maxX - minX) / 2, (maxY - minY) / 2);
    if (radius <= 0) {
        sink.moveTo(minX, minY);
        sink.lineTo(maxX, minY);
        sink.lineTo(maxX, maxY);
        sink.lineTo(minX, maxY);
        sink.closePath();
        return;
    }
    sink.moveTo(minX + radius, minY);
    sink.lineTo(maxX - radius, minY);
    sink.quadraticCurveTo(maxX, minY, maxX, minY + radius);
    sink.lineTo(maxX, maxY - radius);
    sink.quadraticCurveTo(maxX, maxY, maxX - radius, maxY);
    sink.lineTo(minX + radius, maxY);
    sink.quadraticCurveTo(minX, maxY, minX, maxY - radius);
    sink.lineTo(minX, minY + radius);
    sink.quadraticCurveTo(minX, minY, minX + radius, minY);
    sink.closePath();
};

// The silhouette comes first so a point sampler can stop after one subpath;
// the rim's front curve is a second, stroke-only subpath.
const CYLINDER_RIM = 0.14;
const traceCylinder = (sink, at) => {
    const k = ELLIPSE_KAPPA / 2;
    const rim = CYLINDER_RIM;
    sink.moveTo(...at(0, rim));
    sink.bezierCurveTo(...at(0, rim - rim * ELLIPSE_KAPPA), ...at(0.5 - k, 0), ...at(0.5, 0));
    sink.bezierCurveTo(...at(0.5 + k, 0), ...at(1, rim - rim * ELLIPSE_KAPPA), ...at(1, rim));
    sink.lineTo(...at(1, 1 - rim));
    sink.bezierCurveTo(...at(1, 1 - rim + rim * ELLIPSE_KAPPA), ...at(0.5 + k, 1), ...at(0.5, 1));
    sink.bezierCurveTo(...at(0.5 - k, 1), ...at(0, 1 - rim + rim * ELLIPSE_KAPPA), ...at(0, 1 - rim));
    sink.closePath();
    sink.moveTo(...at(0, rim));
    sink.bezierCurveTo(...at(0, rim + rim * ELLIPSE_KAPPA), ...at(0.5 - k, 2 * rim), ...at(0.5, 2 * rim));
    sink.bezierCurveTo(...at(0.5 + k, 2 * rim), ...at(1, rim + rim * ELLIPSE_KAPPA), ...at(1, rim));
};

const traceDocument = (sink, at) => {
    sink.moveTo(...at(0, 0));
    sink.lineTo(...at(1, 0));
    sink.lineTo(...at(1, 0.86));
    sink.bezierCurveTo(...at(0.75, 0.72), ...at(0.5, 0.98), ...at(0.25, 1));
    sink.bezierCurveTo(...at(0.15, 1), ...at(0.06, 0.96), ...at(0, 0.9));
    sink.closePath();
};

const traceCloud = (sink, at) => {
    sink.moveTo(...at(0.24, 0.92));
    sink.bezierCurveTo(...at(0.06, 0.94), ...at(0, 0.72), ...at(0.08, 0.6));
    sink.bezierCurveTo(...at(0, 0.44), ...at(0.1, 0.28), ...at(0.24, 0.32));
    sink.bezierCurveTo(...at(0.28, 0.08), ...at(0.52, 0.02), ...at(0.62, 0.2));
    sink.bezierCurveTo(...at(0.74, 0.08), ...at(0.92, 0.18), ...at(0.88, 0.38));
    sink.bezierCurveTo(...at(1, 0.46), ...at(1, 0.84), ...at(0.8, 0.92));
    sink.closePath();
};

const traceCallout = (sink, at) => {
    sink.moveTo(...at(0.1, 0));
    sink.lineTo(...at(0.9, 0));
    sink.quadraticCurveTo(...at(1, 0), ...at(1, 0.1));
    sink.lineTo(...at(1, 0.68));
    sink.quadraticCurveTo(...at(1, 0.78), ...at(0.9, 0.78));
    sink.lineTo(...at(0.42, 0.78));
    sink.lineTo(...at(0.2, 1));
    sink.lineTo(...at(0.26, 0.78));
    sink.lineTo(...at(0.1, 0.78));
    sink.quadraticCurveTo(...at(0, 0.78), ...at(0, 0.68));
    sink.lineTo(...at(0, 0.1));
    sink.quadraticCurveTo(...at(0, 0), ...at(0.1, 0));
    sink.closePath();
};

const traceRegion = (sink, element, at) => {
    (element.rings || []).forEach((ring) => {
        ring.forEach(({ x, y }, i) => {
            if (i === 0) sink.moveTo(...at(x, y));
            else sink.lineTo(...at(x, y));
        });
        sink.closePath();
    });
};

const OPEN_ARROW_HEAD_PX = 15;
const traceOpenShape = (sink, element) => {
    const { startX, startY, endX, endY, shapeType } = element;
    sink.moveTo(startX, startY);
    sink.lineTo(endX, endY);
    if (shapeType !== "Arrow") return;
    const angle = Math.atan2(endY - startY, endX - startX);
    sink.lineTo(endX - OPEN_ARROW_HEAD_PX * Math.cos(angle - Math.PI / 6), endY - OPEN_ARROW_HEAD_PX * Math.sin(angle - Math.PI / 6));
    sink.moveTo(endX, endY);
    sink.lineTo(endX - OPEN_ARROW_HEAD_PX * Math.cos(angle + Math.PI / 6), endY - OPEN_ARROW_HEAD_PX * Math.sin(angle + Math.PI / 6));
};

// Each corner is cut back along its two edges and joined by a curve, never by
// more than half an edge, so neighbouring curves can't overlap.
const tracePolygon = (sink, corners, radius) => {
    corners.forEach((corner, i) => {
        const previous = corners[(i + corners.length - 1) % corners.length];
        const next = corners[(i + 1) % corners.length];
        const toward = (other) => {
            const dx = other[0] - corner[0];
            const dy = other[1] - corner[1];
            const length = Math.hypot(dx, dy) || 1;
            const cut = Math.min(radius, length / 2);
            return [corner[0] + (dx / length) * cut, corner[1] + (dy / length) * cut];
        };
        const entry = radius > 0 ? toward(previous) : corner;
        if (i === 0) sink.moveTo(...entry);
        else sink.lineTo(...entry);
        if (radius > 0) sink.quadraticCurveTo(corner[0], corner[1], ...toward(next));
    });
    sink.closePath();
};

// A head over shoulders; the label sits in the band below the figure.
const tracePerson = (sink, at) => {
    sink.moveTo(...at(0.14, 0.62));
    sink.lineTo(...at(0.14, 0.5));
    sink.bezierCurveTo(...at(0.14, 0.38), ...at(0.26, 0.34), ...at(0.38, 0.34));
    sink.lineTo(...at(0.62, 0.34));
    sink.bezierCurveTo(...at(0.74, 0.34), ...at(0.86, 0.38), ...at(0.86, 0.5));
    sink.lineTo(...at(0.86, 0.62));
    sink.closePath();
    const k = ELLIPSE_KAPPA;
    const [cx, cy, rx, ry] = [0.5, 0.16, 0.13, 0.15];
    sink.moveTo(...at(cx, cy - ry));
    sink.bezierCurveTo(...at(cx + rx * k, cy - ry), ...at(cx + rx, cy - ry * k), ...at(cx + rx, cy));
    sink.bezierCurveTo(...at(cx + rx, cy + ry * k), ...at(cx + rx * k, cy + ry), ...at(cx, cy + ry));
    sink.bezierCurveTo(...at(cx - rx * k, cy + ry), ...at(cx - rx, cy + ry * k), ...at(cx - rx, cy));
    sink.bezierCurveTo(...at(cx - rx, cy - ry * k), ...at(cx - rx * k, cy - ry), ...at(cx, cy - ry));
    sink.closePath();
};

const traceBrowser = (sink, element, at) => {
    traceRectangle(sink, element);
    sink.moveTo(...at(0, 0.16));
    sink.lineTo(...at(1, 0.16));
    [0.05, 0.09, 0.13].forEach((u) => {
        sink.moveTo(...at(u, 0.08));
        sink.lineTo(...at(u + 0.004, 0.08));
    });
};

const tracePhone = (sink, element, at) => {
    traceRectangle(sink, { ...element, cornerRadius: Math.min(Math.abs(element.endX - element.startX), Math.abs(element.endY - element.startY)) * 0.16 });
    sink.moveTo(...at(0.4, 0.06));
    sink.lineTo(...at(0.6, 0.06));
    sink.moveTo(...at(0.42, 0.94));
    sink.lineTo(...at(0.58, 0.94));
};

const traceFolder = (sink, at) => {
    sink.moveTo(...at(0, 0));
    sink.lineTo(...at(0.36, 0));
    sink.lineTo(...at(0.44, 0.12));
    sink.lineTo(...at(1, 0.12));
    sink.lineTo(...at(1, 1));
    sink.lineTo(...at(0, 1));
    sink.closePath();
};

// A cylinder on its side: the right end's front face is a second, stroke-only subpath.
const QUEUE_RIM = 0.1;
const traceQueue = (sink, at) => {
    const k = ELLIPSE_KAPPA;
    const r = QUEUE_RIM;
    sink.moveTo(...at(r, 0));
    sink.lineTo(...at(1 - r, 0));
    sink.bezierCurveTo(...at(1 - r + r * k, 0), ...at(1, 0.5 - 0.5 * k), ...at(1, 0.5));
    sink.bezierCurveTo(...at(1, 0.5 + 0.5 * k), ...at(1 - r + r * k, 1), ...at(1 - r, 1));
    sink.lineTo(...at(r, 1));
    sink.bezierCurveTo(...at(r - r * k, 1), ...at(0, 0.5 + 0.5 * k), ...at(0, 0.5));
    sink.bezierCurveTo(...at(0, 0.5 - 0.5 * k), ...at(r - r * k, 0), ...at(r, 0));
    sink.closePath();
    sink.moveTo(...at(1 - r, 0));
    sink.bezierCurveTo(...at(1 - r - r * k, 0), ...at(1 - 2 * r, 0.5 - 0.5 * k), ...at(1 - 2 * r, 0.5));
    sink.bezierCurveTo(...at(1 - 2 * r, 0.5 + 0.5 * k), ...at(1 - r - r * k, 1), ...at(1 - r, 1));
};

const traceIsoBlock = (sink, at) => {
    sink.moveTo(...at(0.5, 0));
    sink.lineTo(...at(1, 0.18));
    sink.lineTo(...at(1, 0.82));
    sink.lineTo(...at(0.5, 1));
    sink.lineTo(...at(0, 0.82));
    sink.lineTo(...at(0, 0.18));
    sink.closePath();
    sink.moveTo(...at(0, 0.18));
    sink.lineTo(...at(0.5, 0.36));
    sink.lineTo(...at(1, 0.18));
    sink.moveTo(...at(0.5, 0.36));
    sink.lineTo(...at(0.5, 1));
};

const traceDataStore = (sink, element, at) => {
    traceRectangle(sink, element);
    sink.moveTo(...at(0.16, 0));
    sink.lineTo(...at(0.16, 1));
};

const traceAndGate = (sink, at) => {
    sink.moveTo(...at(0, 1));
    sink.lineTo(...at(0, 0.5));
    sink.bezierCurveTo(...at(0, 0.22), ...at(0.22, 0), ...at(0.5, 0));
    sink.bezierCurveTo(...at(0.78, 0), ...at(1, 0.22), ...at(1, 0.5));
    sink.lineTo(...at(1, 1));
    sink.closePath();
};

const traceOrGate = (sink, at) => {
    sink.moveTo(...at(0, 1));
    sink.quadraticCurveTo(...at(0.5, 0.74), ...at(1, 1));
    sink.bezierCurveTo(...at(1, 0.55), ...at(0.75, 0.15), ...at(0.5, 0));
    sink.bezierCurveTo(...at(0.25, 0.15), ...at(0, 0.55), ...at(0, 1));
    sink.closePath();
};

export const canRoundCorners = (shapeType) => shapeType === "Rectangle" || shapeType === "Browser" || shapeType === "DataStore" || Boolean(POLYGONS[shapeType]);

export const traceShape = (sink, element) => {
    const { shapeType } = element;
    const at = mapper(element);
    if (POLYGONS[shapeType])
        tracePolygon(
            sink,
            POLYGONS[shapeType].map(([u, v]) => at(u, v)),
            element.cornerRadius || 0,
        );
    else if (shapeType === "Rectangle") traceRectangle(sink, element);
    else if (shapeType === "Circle" || shapeType === "Ellipse") traceEllipse(sink, at);
    else if (shapeType === "Cylinder") traceCylinder(sink, at);
    else if (shapeType === "Document") traceDocument(sink, at);
    else if (shapeType === "Cloud") traceCloud(sink, at);
    else if (shapeType === "Callout") traceCallout(sink, at);
    else if (shapeType === "Region") traceRegion(sink, element, at);
    else if (shapeType === "Person") tracePerson(sink, at);
    else if (shapeType === "Browser") traceBrowser(sink, element, at);
    else if (shapeType === "Phone") tracePhone(sink, element, at);
    else if (shapeType === "Folder") traceFolder(sink, at);
    else if (shapeType === "Queue") traceQueue(sink, at);
    else if (shapeType === "IsoBlock") traceIsoBlock(sink, at);
    else if (shapeType === "DataStore") traceDataStore(sink, element, at);
    else if (shapeType === "AndGate") traceAndGate(sink, at);
    else if (shapeType === "OrGate") traceOrGate(sink, at);
    // An icon's own paths are painted separately; its outline is its box.
    else if (shapeType === "Icon") traceRectangle(sink, { ...element, cornerRadius: 0 });
    else if (OPEN_SHAPE_TYPES.includes(shapeType)) traceOpenShape(sink, element);
};

// Collects a trace as an SVG path `d` string.
export const shapeToSvgPath = (element) => {
    const parts = [];
    traceShape(
        {
            moveTo: (x, y) => parts.push(`M${x} ${y}`),
            lineTo: (x, y) => parts.push(`L${x} ${y}`),
            quadraticCurveTo: (a, b, x, y) => parts.push(`Q${a} ${b} ${x} ${y}`),
            bezierCurveTo: (a, b, c, d, x, y) => parts.push(`C${a} ${b} ${c} ${d} ${x} ${y}`),
            closePath: () => parts.push("Z"),
        },
        element,
    );
    return parts.join(" ");
};

// The first subpath of a trace as points, curves sampled, unrotated.
const firstSubpathPoints = (element) => {
    const points = [];
    let subpaths = 0;
    const lastPoint = () => points[points.length - 1];
    traceShape(
        {
            moveTo: (x, y) => {
                subpaths += 1;
                if (subpaths === 1) points.push({ x, y });
            },
            lineTo: (x, y) => {
                if (subpaths === 1) points.push({ x, y });
            },
            quadraticCurveTo: (cx, cy, x, y) => {
                if (subpaths !== 1) return;
                const from = lastPoint();
                for (let i = 1; i <= CURVE_SAMPLES; i += 1) {
                    const t = i / CURVE_SAMPLES;
                    const mt = 1 - t;
                    points.push({ x: mt * mt * from.x + 2 * mt * t * cx + t * t * x, y: mt * mt * from.y + 2 * mt * t * cy + t * t * y });
                }
            },
            bezierCurveTo: (ax, ay, bx, by, x, y) => {
                if (subpaths !== 1) return;
                const from = lastPoint();
                for (let i = 1; i <= CURVE_SAMPLES; i += 1) {
                    const t = i / CURVE_SAMPLES;
                    const mt = 1 - t;
                    points.push({
                        x: mt ** 3 * from.x + 3 * mt * mt * t * ax + 3 * mt * t * t * bx + t ** 3 * x,
                        y: mt ** 3 * from.y + 3 * mt * mt * t * ay + 3 * mt * t * t * by + t ** 3 * y,
                    });
                }
            },
            closePath: () => {},
        },
        element,
    );
    return points;
};

export const isClosedShape = (element) => element?.type === "shape" && !OPEN_SHAPE_TYPES.includes(element.shapeType);

export const shapeOutlinePoints = (element) => firstSubpathPoints(element);

// Where a silhouette leaves room for words, as fractions of its box: the band
// under a person's figure, below a browser's bar, beside a data store's id.
const TEXT_AREAS = {
    Person: { left: 0.02, top: 0.64, right: 0.02, bottom: 0.02 },
    Browser: { left: 0.06, top: 0.2, right: 0.06, bottom: 0.06 },
    Phone: { left: 0.1, top: 0.14, right: 0.1, bottom: 0.14 },
    Folder: { left: 0.06, top: 0.18, right: 0.06, bottom: 0.06 },
    Queue: { left: 0.14, top: 0.08, right: 0.16, bottom: 0.08 },
    IsoBlock: { left: 0.08, top: 0.38, right: 0.08, bottom: 0.08 },
    DataStore: { left: 0.2, top: 0.08, right: 0.04, bottom: 0.08 },
    AndGate: { left: 0.12, top: 0.4, right: 0.12, bottom: 0.06 },
    OrGate: { left: 0.18, top: 0.42, right: 0.18, bottom: 0.2 },
};

// The box a shape's own text wraps in, unrotated. An icon beside or above
// the words pushes them over by `textInsetLeft` or down by `textInsetTop`.
export const shapeTextBox = (element) => {
    const minX = Math.min(element.startX, element.endX);
    const minY = Math.min(element.startY, element.endY);
    const width = Math.abs(element.endX - element.startX);
    const height = Math.abs(element.endY - element.startY);
    const area = TEXT_AREAS[element.shapeType];
    const insetLeft = element.textInsetLeft ?? 0;
    const insetTop = element.textInsetTop ?? 0;
    if (area) {
        return {
            x: minX + width * area.left + insetLeft,
            y: minY + height * area.top + insetTop,
            width: Math.max(1, width * (1 - area.left - area.right) - insetLeft),
            height: Math.max(1, height * (1 - area.top - area.bottom) - insetTop),
        };
    }
    const inset = TEXT_INSETS[element.shapeType] ?? 0.06;
    const callout = element.shapeType === "Callout" ? 0.78 : 1;
    return {
        x: minX + width * inset + insetLeft,
        y: minY + height * inset * callout + insetTop,
        width: Math.max(1, width * (1 - 2 * inset) - insetLeft),
        height: Math.max(1, height * callout * (1 - 2 * inset) - insetTop),
    };
};
