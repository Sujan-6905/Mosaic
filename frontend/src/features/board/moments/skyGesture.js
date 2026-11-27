const MIN_POINTS = 12;
const MIN_SIZE = 40;

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const convexHull = (points) => {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const half = (list) => {
        const out = [];
        for (const p of list) {
            while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
            out.push(p);
        }
        out.pop();
        return out;
    };
    return [...half(sorted), ...half([...sorted].reverse())];
};

const area = (polygon) => Math.abs(polygon.reduce((sum, p, n) => sum + cross({ x: 0, y: 0 }, p, polygon[(n + 1) % polygon.length]), 0)) / 2;

// Closed strokes: a sun fills its convex hull and a crescent leaves a bite out of it. An open C curling most
// of the way round its middle is also a crescent; lines and small scribbles are neither.
export function recogniseSky(points) {
    if (points.length < MIN_POINTS) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const size = Math.hypot(width, height);
    if (size < MIN_SIZE) return null;
    const hull = convexHull(points);
    const hullArea = area(hull);
    // Something long and thin has no inside to speak of.
    if (hullArea < size * size * 0.12) return null;

    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < size * 0.25) {
        return area(points) / hullArea >= 0.78 ? "sun" : "moon";
    }

    const cx = Math.min(...xs) + width / 2;
    const cy = Math.min(...ys) + height / 2;
    let turn = 0;
    for (let n = 1; n < points.length; n += 1) {
        let delta = Math.atan2(points[n].y - cy, points[n].x - cx) - Math.atan2(points[n - 1].y - cy, points[n - 1].x - cx);
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        turn += delta;
    }
    return (Math.abs(turn) * 180) / Math.PI >= 150 ? "moon" : null;
}
