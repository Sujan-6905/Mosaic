// Tapered, pressure-sensitive stroke outlines from perfect-freehand. Geometry only; callers draw it.
import { getStroke } from "perfect-freehand";
import { simplifyPathPoints } from "./lod";

// Keyed by line style, which already tells pencil, pen and highlighter apart. The option names are
// perfect-freehand's, tuned so the three read as different instruments.
const STROKE_PRESETS = {
    // Pencil: grainy, tapers noticeably with pressure/speed.
    round: { thinning: 0.6, smoothing: 0.5, streamline: 0.4 },
    // Pen: deliberate, more uniform width, tapers only at the very ends.
    square: { thinning: 0.25, smoothing: 0.6, streamline: 0.6 },
    // Highlighter: near-constant width, minimal taper: a flat marker, not
    // a nib. Translucency itself comes from the element's own `opacity`.
    butt: { thinning: 0.05, smoothing: 0.3, streamline: 0.5 },
};
const DEFAULT_PRESET = STROKE_PRESETS.round;
const SPEED_SMOOTHING = 0.25;

export const getStrokePreset = (style) => STROKE_PRESETS[style] || DEFAULT_PRESET;

// Without a pressure sensor, pointers report a constant 0.5, so width comes from speed instead.
export const pressureFromVelocity = (points) => {
    if (points.length === 0) return [];
    if (points.length === 1) return [{ ...points[0], pressure: 0.5 }];

    // Eased, because raw pointer gaps jump between samples and would read as a
    // lumpy line rather than a pen slowing down.
    const speeds = [0];
    for (let i = 1; i < points.length; i++) {
        const raw = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        speeds.push(speeds[i - 1] + (raw - speeds[i - 1]) * SPEED_SMOOTHING);
    }
    const maxSpeed = Math.max(...speeds, 1);
    return points.map((point, i) => ({
        ...point,
        pressure: Math.max(0.15, 1 - speeds[i] / maxSpeed),
    }));
};

// Whether a stroke's raw pressure is real is decided for the whole stroke, so pressures resolve after collection.
export const resolveStrokePressures = (points, usesRealPressure) => {
    // A stylus without a sensor reports one constant value, which says nothing.
    if (usesRealPressure && points.some((p) => p.rawPressure !== 0.5 && p.rawPressure !== 0)) {
        return points.map((p) => ({ x: p.x, y: p.y, pressure: p.rawPressure }));
    }
    return pressureFromVelocity(points);
};

// An outline polygon ready to fill; fewer than two points give an empty one rather than an error.
export const getStrokeOutline = (points, { size = 4, style = "round", pressure = null, steadying = null } = {}) => {
    if (!points || points.length < 2) return [];
    const preset = getStrokePreset(style);
    const input = points.map((p) => [p.x, p.y, p.pressure ?? 0.5]);
    const outline = getStroke(input, {
        size,
        thinning: pressure ?? preset.thinning,
        smoothing: preset.smoothing,
        streamline: steadying ?? preset.streamline,
        // Pressure is always already resolved by the caller (real or from speed).
        simulatePressure: false,
    });
    return outline.map(([x, y]) => ({ x, y }));
};

export const strokeOutlineOptions = (element) => ({
    size: element.size,
    style: element.style,
    pressure: element.pressure ?? null,
    steadying: element.steadying ?? null,
});

// The one fill for both the live overlay and the committed board.
export const fillStrokeOutline = (context, outline) => {
    if (outline.length < 3) return;
    context.beginPath();
    context.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) {
        context.lineTo(outline[i].x, outline[i].y);
    }
    context.closePath();
    context.fill();
};

const buildPolygonPath = (points) => {
    const path = new Path2D();
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
    path.closePath();
    return path;
};

const strokePathCache = new WeakMap();

const buildStrokePaths = (points, element) => {
    const outline = getStrokeOutline(points, strokeOutlineOptions(element));
    return {
        outline: outline.length >= 3 ? buildPolygonPath(outline) : null,
        interior: element.fillColor && points.length >= 3 ? buildPolygonPath(points) : null,
    };
};

// Builds a committed stroke's paths once per detail level, keyed by the element, which edits replace.
export const getStrokePaths = (element, simplifyTolerance = null) => {
    let byTolerance = strokePathCache.get(element);
    if (!byTolerance) {
        byTolerance = new Map();
        strokePathCache.set(element, byTolerance);
    }
    let paths = byTolerance.get(simplifyTolerance);
    if (!paths) {
        const points = simplifyTolerance === null ? element.points : simplifyPathPoints(element.points, simplifyTolerance);
        paths = buildStrokePaths(points, element);
        byTolerance.set(simplifyTolerance, paths);
    }
    return paths;
};

// Fills a committed stroke: interior first, so the line stays on top of it.
export const paintStrokePaths = (context, { outline, interior }, color, fillColor) => {
    if (interior) {
        context.fillStyle = fillColor;
        context.fill(interior);
    }
    if (outline) {
        context.fillStyle = color;
        context.fill(outline);
    }
};
