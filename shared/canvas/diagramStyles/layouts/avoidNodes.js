// Any layout can leave a link running through a box that is not one of its ends. Such a link is routed again
// along a grid made from the gaps between boxes, shortest first with a cost for every bend, so it goes round them.
import { nodeBox } from "./common.js";

const MARGIN = 16;
const BEND_COST = 60;

const inflate = (box, by) => ({ minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by });

// Whether segment p-q passes through the inside of a box (Liang-Barsky clipping).
const crosses = (p, q, box) => {
    let low = 0;
    let high = 1;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    for (const [step, gap] of [
        [-dx, p.x - box.minX],
        [dx, box.maxX - p.x],
        [-dy, p.y - box.minY],
        [dy, box.maxY - p.y],
    ]) {
        if (step === 0) {
            if (gap <= 0) return false;
            continue;
        }
        const t = gap / step;
        if (step < 0) low = Math.max(low, t);
        else high = Math.min(high, t);
        if (low >= high) return false;
    }
    return high - low > 1e-6;
};

// The grid lines are every box side and every node centre. Each step between neighbouring points records the
// boxes it would enter, so one grid serves every link: a link may enter only its own two ends.
const buildGrid = (scene, ids, boxes) => {
    const xs = [...new Set(ids.flatMap((id) => [scene.nodes[id].cx, boxes[id].minX, boxes[id].maxX]))].sort((p, q) => p - q);
    const ys = [...new Set(ids.flatMap((id) => [scene.nodes[id].cy, boxes[id].minY, boxes[id].maxY]))].sort((p, q) => p - q);
    // A grid step is horizontal or vertical, so a box blocks it when the step's line runs inside the box's span.
    const blockersAcross = (x0, x1, y) => ids.filter((id) => y > boxes[id].minY && y < boxes[id].maxY && x0 < boxes[id].maxX && x1 > boxes[id].minX);
    const blockersDown = (x, y0, y1) => ids.filter((id) => x > boxes[id].minX && x < boxes[id].maxX && y0 < boxes[id].maxY && y1 > boxes[id].minY);
    const across = xs.slice(0, -1).map((x, i) => ys.map((y) => blockersAcross(x, xs[i + 1], y)));
    const down = xs.map((x) => ys.slice(0, -1).map((y, j) => blockersDown(x, y, ys[j + 1])));
    return { xs, ys, across, down };
};

const pushHeap = (heap, item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) {
        const parent = (i - 1) >> 1;
        if (heap[parent].rank <= heap[i].rank) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
    }
};

const popHeap = (heap) => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
            const [l, r] = [2 * i + 1, 2 * i + 2];
            let smallest = i;
            if (l < heap.length && heap[l].rank < heap[smallest].rank) smallest = l;
            if (r < heap.length && heap[r].rank < heap[smallest].rank) smallest = r;
            if (smallest === i) break;
            [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
            i = smallest;
        }
    }
    return top;
};

const MOVES = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 1],
    [0, -1, 1],
];

// Shortest orthogonal path from one node's centre to the other's, entering no box but theirs.
const gridRoute = (grid, a, b, ends) => {
    const { xs, ys, across, down } = grid;
    const allowed = (blockers) => blockers.every((id) => ends.has(id));
    const step = (i, j, di, dj) => (di ? across[Math.min(i, i + di)][j] : down[i][Math.min(j, j + dj)]);
    const [si, sj, ti, tj] = [xs.indexOf(a.cx), ys.indexOf(a.cy), xs.indexOf(b.cx), ys.indexOf(b.cy)];
    // Ranked by cost so far plus the straight distance left, which never overestimates, so the first arrival is best.
    const left = (i, j) => Math.abs(xs[i] - xs[ti]) + Math.abs(ys[j] - ys[tj]);
    const best = new Float64Array(xs.length * ys.length * 2).fill(Infinity);
    const heap = [];
    pushHeap(heap, { i: si, j: sj, dir: -1, cost: 0, rank: left(si, sj), from: null });
    while (heap.length) {
        const here = popHeap(heap);
        if (here.i === ti && here.j === tj) {
            const path = [];
            for (let node = here; node; node = node.from) path.unshift({ x: xs[node.i], y: ys[node.j] });
            return path;
        }
        for (const [di, dj, dir] of MOVES) {
            const i = here.i + di;
            const j = here.j + dj;
            if (i < 0 || j < 0 || i >= xs.length || j >= ys.length || !allowed(step(here.i, here.j, di, dj))) continue;
            const length = Math.abs(xs[i] - xs[here.i]) + Math.abs(ys[j] - ys[here.j]);
            const cost = here.cost + length + (here.dir !== -1 && here.dir !== dir ? BEND_COST : 0);
            const key = (i * ys.length + j) * 2 + dir;
            if (cost >= best[key]) continue;
            best[key] = cost;
            pushHeap(heap, { i, j, dir, cost, rank: cost + left(i, j), from: here });
        }
    }
    return null;
};

const withoutStraightRuns = (points) =>
    points.filter((point, index) => {
        if (index === 0 || index === points.length - 1) return true;
        const [before, after] = [points[index - 1], points[index + 1]];
        return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
    });

export const routeAroundNodes = (scene) => {
    const ids = Object.keys(scene.nodes);
    const boxes = Object.fromEntries(ids.map((id) => [id, inflate(nodeBox(scene.nodes[id]), MARGIN)]));
    let grid = null;
    scene.edges.forEach((edge) => {
        const a = scene.nodes[edge.from];
        const b = scene.nodes[edge.to];
        if (!a || !b || edge.from === edge.to || edge.free) return;
        const current = [{ x: a.cx, y: a.cy }, ...(edge.waypoints ?? []), { x: b.cx, y: b.cy }];
        const blocked = current.some(
            (point, index) => index > 0 && ids.some((id) => id !== edge.from && id !== edge.to && crosses(current[index - 1], point, boxes[id])),
        );
        if (!blocked) return;
        grid ??= buildGrid(scene, ids, boxes);
        const path = gridRoute(grid, a, b, new Set([edge.from, edge.to]));
        if (!path) return;
        const waypoints = withoutStraightRuns(path).slice(1, -1);
        if (waypoints.length === 0) return;
        edge.waypoints = waypoints;
        delete edge.labelT;
        // A curve can follow the new route; a straight or elbow link would ignore it.
        if (edge.routing !== "curved") delete edge.routing;
    });
};
