// Finds the area enclosed around a point, like a paint bucket, and traces it into polygons.

const WALL_ALPHA = 48;
const SIMPLIFY_TOLERANCE = 0.8;
const MAX_POINTS = 3500;

// Scanline flood fill. Returns the filled mask, or null if the fill reached the
// picture's edge, which means nothing encloses the point.
export const floodFillEnclosed = (alpha, width, height, startX, startY) => {
    const isWall = (index) => alpha[index] > WALL_ALPHA;
    const startIndex = startY * width + startX;
    if (startX < 0 || startY < 0 || startX >= width || startY >= height || isWall(startIndex)) return null;
    const filled = new Uint8Array(width * height);
    const stack = [[startX, startY]];
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        let left = x;
        while (left >= 0 && !filled[y * width + left] && !isWall(y * width + left)) left -= 1;
        left += 1;
        let spanAbove = false;
        let spanBelow = false;
        for (let cursor = left; cursor < width; cursor += 1) {
            const index = y * width + cursor;
            if (filled[index] || isWall(index)) break;
            if (cursor === 0 || cursor === width - 1 || y === 0 || y === height - 1) return null;
            filled[index] = 1;
            const aboveOpen = !filled[index - width] && !isWall(index - width);
            if (aboveOpen && !spanAbove) stack.push([cursor, y - 1]);
            spanAbove = aboveOpen;
            const belowOpen = !filled[index + width] && !isWall(index + width);
            if (belowOpen && !spanBelow) stack.push([cursor, y + 1]);
            spanBelow = belowOpen;
        }
    }
    return filled;
};

// Spreads the fill by `radius` pixels so it tucks under the antialiased edge of
// its walls, leaving no pale seam between the fill and the line around it.
export const dilateMask = (mask, width, height, radius) => {
    let current = mask;
    for (let pass = 0; pass < radius; pass += 1) {
        const next = current.slice();
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const index = y * width + x;
                if (!current[index] && (current[index - 1] || current[index + 1] || current[index - width] || current[index + width])) next[index] = 1;
            }
        }
        current = next;
    }
    return current;
};

const distanceToSegment = (point, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
    const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
};

const simplifyRing = (points, tolerance) => {
    if (points.length < 4) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length > 0) {
        const [first, last] = stack.pop();
        let furthest = -1;
        let furthestDistance = tolerance;
        for (let i = first + 1; i < last; i += 1) {
            const distance = distanceToSegment(points[i], points[first], points[last]);
            if (distance > furthestDistance) {
                furthestDistance = distance;
                furthest = i;
            }
        }
        if (furthest >= 0) {
            keep[furthest] = 1;
            stack.push([first, furthest], [furthest, last]);
        }
    }
    return points.filter((_, i) => keep[i]);
};

// Walks the mask's cell edges into closed loops: an outer boundary, plus one
// more for every hole. Each edge keeps the filled cell on its right.
export const traceMaskRings = (mask, width, height) => {
    const edges = new Map();
    const keyOf = (x, y) => y * (width + 1) + x;
    const addEdge = (fromX, fromY, toX, toY) => {
        const from = keyOf(fromX, fromY);
        if (!edges.has(from)) edges.set(from, []);
        edges.get(from).push(keyOf(toX, toY));
    };
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!mask[y * width + x]) continue;
            if (y === 0 || !mask[(y - 1) * width + x]) addEdge(x, y, x + 1, y);
            if (x === width - 1 || !mask[y * width + x + 1]) addEdge(x + 1, y, x + 1, y + 1);
            if (y === height - 1 || !mask[(y + 1) * width + x]) addEdge(x + 1, y + 1, x, y + 1);
            if (x === 0 || !mask[y * width + x - 1]) addEdge(x, y + 1, x, y);
        }
    }
    const rings = [];
    for (const start of edges.keys()) {
        while (edges.get(start)?.length) {
            const ring = [];
            let at = start;
            while (edges.get(at)?.length) {
                ring.push({ x: at % (width + 1), y: Math.floor(at / (width + 1)) });
                at = edges.get(at).pop();
                if (at === start) break;
            }
            if (ring.length >= 3) rings.push(ring);
        }
    }
    return rings;
};

// The enclosed area around (startX, startY) as rings in picture pixels, or null.
export const enclosedRegionRings = (alpha, width, height, startX, startY, { grow = 2 } = {}) => {
    const filled = floodFillEnclosed(alpha, width, height, startX, startY);
    if (!filled) return null;
    const rings = traceMaskRings(dilateMask(filled, width, height, grow), width, height);
    let simplified = rings.map((ring) => simplifyRing(ring, SIMPLIFY_TOLERANCE)).filter((ring) => ring.length >= 3);
    let total = simplified.reduce((sum, ring) => sum + ring.length, 0);
    let tolerance = SIMPLIFY_TOLERANCE;
    while (total > MAX_POINTS) {
        tolerance *= 2;
        simplified = rings.map((ring) => simplifyRing(ring, tolerance)).filter((ring) => ring.length >= 3);
        total = simplified.reduce((sum, ring) => sum + ring.length, 0);
    }
    return simplified;
};
