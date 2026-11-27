export const MAX_STROKE_POINTS = 10000;

// Points closer than this on screen add bytes without changing the drawn line.
const MIN_SCREEN_STEP_PX = 0.5;

const round2 = (value) => Math.round(value * 100) / 100;

// Shrinks a stroke for the wire and the board document: drops sub-pixel steps, rounds to
// hundredths, and evenly thins anything still over the point cap. First and last points stay.
export const compactStrokePoints = (points, zoom = 1) => {
    if (points.length < 3) return points.map(roundPoint);
    const minStep = MIN_SCREEN_STEP_PX / Math.max(zoom, 0.01);
    const kept = [points[0]];
    for (let i = 1; i < points.length - 1; i += 1) {
        const last = kept[kept.length - 1];
        if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minStep) kept.push(points[i]);
    }
    kept.push(points[points.length - 1]);

    const thinned = kept.length > MAX_STROKE_POINTS ? thinEvenly(kept, MAX_STROKE_POINTS) : kept;
    return thinned.map(roundPoint);
};

const thinEvenly = (points, limit) => {
    const step = (points.length - 1) / (limit - 1);
    return Array.from({ length: limit }, (_, i) => points[Math.round(i * step)]);
};

const roundPoint = (point) => {
    const rounded = { x: round2(point.x), y: round2(point.y) };
    if (point.pressure !== undefined) rounded.pressure = round2(point.pressure);
    return rounded;
};
